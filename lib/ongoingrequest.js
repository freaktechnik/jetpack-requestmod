/*
 * OngoingRequest by Martin Giger
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 */

//TODO HeaderList for more efficient header manipulation

"use strict";

const { Class } = require("sdk/core/heritage");
const { Disposable } = require("sdk/core/disposable");
const { Unknown } = require("sdk/platform/xpcom");
const { Ci, Cr } = require("chrome");
const { newURI } = require("sdk/url/utils");
const { InputStream } = require("./inputstream");
const { contract } = require("sdk/util/contract");
const { NetUtil } = require("resource://gre/modules/NetUtil.jsm");

const NS_ERROR_NOT_AVAILABLE = new Error("Operation could not be completed because some other necessary component or resource was not available.");

const INCOMING = 0;
exports.INCOMING = INCOMING;
const OUTGOING = 1;
exports.OUTGOING = OUTGOING;

let channels = new WeakMap();
let models = new WeakMap();

let channelFor = (oreq) => channels.get(oreq);
let modelFor = (oreq) => models.get(oreq);

let isDirection = (v) => v === INCOMING || v === OUTGOING;

const requestContract = contract({
    channel: {
        is: ['object'],
        ok: (channel) => channel instanceof Ci.nsIHttpChannel,
        msg: 'The `channel` option must always implement nsIHttpChannel.'
    },
    direction: {
        is: ['number'],
        ok: (direction) => isDirection(direction),
        msg: 'The `direction` option must always be a single direction constant.'
    }
});

const Listener = Class({
    extends: Unknown,
    interfaces: [ 'nsIStreamListener' ],
    called: false,
    value: "",
    oldListener: null,
    context: null,
    done: false,
    processor: null,
    onStartRequest: function(request, context) {
        this.context = context;
        this.oldListener.onStartRequest(request, context);
    },
    onDataAvailable: function(request, context, inputStream, offset, count) {
        if(!this.called) {
            this.value += NetUtil.readInputStreamToString(inputStream, count);
        }
        this.context = context;
    },
    onStopRequest: function(request, context, status) {
        if(this.processor !== null) {
            this.value = this.processor(this.value);
        }

        let stream = InputStream(this.value).stream;
        this.oldListener.onDataAvailable(request, context, stream, 0, stream.available());
        this.oldListener.onStopRequest(request, context, status);
        this.done = true;
    }
});

const OngoingRequest = Class({
    extends: Disposable,
    setup: function(options) {
        requestContract(options);
        // In theory the contract already did this check
        options.channel.QueryInterface(Ci.nsIHttpChannel);

        channels.set(this, options.channel);
        models.set(this, { direction: options.direction });

        if(options.direction === INCOMING) {
            options.channel.QueryInterface(Ci.nsITraceableChannel);
            let model = modelFor(this);
            model.listener = Listener();
            model.listener.oldListener = options.channel.setNewListener(model.listener);
        }
    },
    get url() {
        return channelFor(this).URI.spec;
    },
    set url(val) {
        if(this.direction === OUTGOING) {
            channelFor(this).redirectTo(newURI(val));
        }
        else {
            throw NS_ERROR_NOT_AVAILABLE;
        }
    },
    get referrer() {
        return channelFor(this).referrer && channelFor(this).referrer.spec;
    },
    set referrer(val) {
        if(this.direction === OUTGOING) {
            channelFor(this).referrer = newURI(val);
        }
        else {
            throw NS_ERROR_NOT_AVAILABLE;
        }
    },
    get method() {
        return channelFor(this).requestMethod;
    },
    set method(val) {
        if(this.direction === OUTGOING) {
            channelFor(this).requestMethod = val;
        }
        else {
            throw NS_ERROR_NOT_AVAILABLE;
        }
    },
    get status() {
        if(this.direction === INCOMING) {
            return channelFor(this).responseStatus;
        }
        else {
            throw NS_ERROR_NOT_AVAILABLE;
        }
    },
    get headers() {
        let visitor = {
            headers: {},
            visitHeader: function(header, value) {
                this.headers[header] = value;
            }
        };
        if(this.direction === INCOMING) {
            channelFor(this).visitResponseHeaders(visitor);
        }
        else {
            channelFor(this).visitRequestHeaders(visitor);
        }
        return visitor.headers;
    },
    set headers(headers) {
        let channel = channelFor(this);
        let incoming = this.direction === INCOMING;
        for(let h in headers) {
            if(incoming) {
                channel.setResponseHeader(h, headers[h], false);
            }
            else {
                channel.setRequestHeader(h, headers[h], false);
            }
        }
    },
    get content() {
        if(this.direction === OUTGOING) {
            let channel = channelFor(this);
            channel.QueryInterface(Ci.nsIUploadChannel);
            let stream = channel.uploadStream;

            if(stream === null) {
                return null;
            }
            else {
                if(stream.available() > 0) {
                    let options = {};
                    options.charset = this.charset;

                    let value = NetUtil.readInputStreamToString(stream, stream.available(), options);
                    return value;
                }
                else {
                    return null;
                }
            }
        }
        else {
            let { listener } = modelFor(this);
            if(!listener.called && !listener.done) {
                throw NS_ERROR_NOT_AVAILABLE;
            }
            else {
                return modelFor(this).listener.value;
            }
        }
    },
    set content(val) {
        if(this.direction === OUTGOING) {
            let channel = channelFor(this);
            let method = this.method;
            channel.QueryInterface(Ci.nsIUploadChannel);

            if(val === null) {
                let { stream } = InputStream("");
                channel.setUploadStream(stream, "", 0);
            }
            else {
                let { stream } = InputStream(val);

                // url-encoded streams contain all the info inside the stream.
                if(val.includes("x-www-form-urlencoded")) {
                    channel.setUploadStream(stream, "", -1);
                }
                else {
                    channel.setUploadStream(stream, this.type, -1);
                }

            }
            // Re-set method
            this.method = method;
        }
        else {
            modelFor(this).listener.value = val;
            modelFor(this).listener.called = true;
        }
    },
    get type() {
        var type;
        try {
            type = channelFor(this).contentType;
        }
        catch(e) {
            // Try to get the content type from the header then
            try {
                if(this.direction === OUTGOING) {
                    type = channelFor(this).getRequestHeader("Content-Type");
                }
                else {
                    type = channelFor(this).getResponseHeader("Content-Type");
                }
            } catch(e) {
                // header doesn't exist.
                type = "text/plain";
            }
        }
        return type;
    },
    set type(val) {
        channelFor(this).contentType = val;
    },
    get charset() {
        let charset;
        try {
            charset = channelFor(this).contentCharset;
        }
        catch(e) {
            charset = "UTF-8";
        }
        return charset;
    },
    set charset(val) {
        channelFor(this).contentCharset = val;
    },
    get direction() {
        return modelFor(this).direction;
    },
    get notCached() {
        if(this.direction === INCOMING) {
            let channel = channelFor(this);
            return channel.isNoStoreResponse() && channel.isNoCacheResponse() || null;
        }
        else {
            throw NS_ERROR_NOT_AVAILABLE;
        }
    },
    abort: function() {
        let channel = channelFor(this);
        channel.QueryInterface(Ci.nsIRequest);
        channel.cancel(Cr.NS_BINDING_ABORTED);
    },
    processContent: function(callback) {
        if(this.direction === OUTGOING) {
            this.content = callback(this.content);
        }
        else {
            modelFor(this).listener.processor = callback;
        }
    },
    dispose: function() {
        models.delete(this);
        channels.delete(this);
    }
});

exports.OngoingRequest = OngoingRequest;

