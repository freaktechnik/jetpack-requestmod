/*
 * OngoingRequest by Martin Giger
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const { Class } = require("sdk/core/heritage");
const { Disposable } = require("sdk/core/disposable");
const { Unknown } = require("sdk/platform/xpcom");
const { Ci, Cr } = require("chrome");
const { newURI } = require("sdk/url/utils");
const { InputStream } = require("./inputstream");
const { contract } = require("sdk/util/contract");
const { NetUtil } = require("resource://gre/modules/NetUtil.jsm");
const { Headers } = require("./headers");
const { INCOMING, OUTGOING } = require("./const");

const NS_ERROR_NOT_AVAILABLE = new Error("Operation could not be completed because some other necessary component or resource was not available.");

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

        var stream, length;
        if(this.value === null) {
            stream = InputStream("").stream;
            length = 0;
        }
        else if(typeof this.value === "object" && this.value instanceof Ci.nsIInputStream) {
            stream = this.value;
            length = stream.available();
        }
        else {
            stream = InputStream(this.value).stream;
            length = stream.available();
        }
        this.oldListener.onDataAvailable(request, context, stream, 0, length);
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
        models.set(this, { direction: options.direction, headers: Headers(options.channel, options.direction) });

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
        return modelFor(this).headers;
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

                    if(this.type.includes("json")) {
                        value = JSON.parse(value);
                    }

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
            else if(typeof val === "object" && val instanceof Ci.nsIInputStream) {
                if(val instanceof Ci.nsIMIMEInputStream)
                    channel.setUploadStream(val, "", -1);
                else
                    channel.setUploadStream(val, this.type, -1);
            }
            else {
                let { stream } = InputStream(val);

                channel.setUploadStream(stream, this.type, -1);
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
            type = this.headers.get("Content-Type");

            if(type === undefined)
                type = "text/plain";
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
        modelFor(this).headers.destroy();
        models.delete(this);
        channels.delete(this);
    }
});

exports.OngoingRequest = OngoingRequest;

