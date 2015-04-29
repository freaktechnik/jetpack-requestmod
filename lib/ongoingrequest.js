/*
 * OngoingRequest by Martin Giger
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 */

//TODO content type & charset?
//TODO HeaderList for more efficient header manipulation

"use strict";

const { Class } = require("sdk/core/heritage");
const { Disposable } = require("sdk/core/disposable");
const { CC, Ci, Cr } = require("chrome");
const { newURI } = require("sdk/url/utils");
const { InputStream } = require("./inputstream");
const { InputStream: ReadInputStream } = require("sdk/io/stream");
const { contract } = require("sdk/util/contract");
const { NetUtil } = require("resource://gre/modules/NetUtil.jsm");

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
    },
    QueryInterface: function(iface) {
        if(iface.equals(Ci.nsISupports) || iface.equals(Ci.nsIStreamListener))
            return this;
        else
            throw Cr.NS_NOINTERFACE;
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
        if(modelFor(this).direction === OUTGOING) {
            channelFor(this).redirectTo(newURI(val));
        }
        else {
            throw "Cannot redirect an incoming request";
        }
    },
    get referrer() {
        return channelFor(this).referrer && channelFor(this).referrer.spec;
    },
    set referrer(val) {
        if(modelFor(this).direction === OUTGOING) {
            channelFor(this).referrer = newURI(val);
        }
        else {
            throw "Cannot set the referrer of an incoming request";
        }
    },
    get method() {
        return channelFor(this).requestMethod;
    },
    set method(val) {
        if(modelFor(this).direction === OUTGOING) {
            channelFor(this).requestMethod = val;
        }
        else {
            throw "The request method can only be set for outgoing requests";
        }
    },
    get status() {
        if(modelFor(this).direction === INCOMING) {
            return channelFor(this).responseStatus;
        }
        else {
            throw "Status is unavailable for outgoing requests";
        }
    },
    get headers() {
        let visitor = {
            headers: {},
            visitHeader: function(header, value) {
                this.headers[header] = value;
            }
        };
        if(modelFor(this).direction === INCOMING) {
            channelFor(this).visitResponseHeaders(visitor);
        }
        else {
            channelFor(this).visitRequestHeaders(visitor);
        }
        return visitor.headers;
    },
    set headers(headers) {
        let channel = channelFor(this);
        let incoming = modelFor(this).direction === INCOMING;
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
        if(modelFor(this).direction === OUTGOING) {
            let channel = channelFor(this);
            channel.QueryInterface(Ci.nsIUploadChannel);
            let stream = channel.uploadStream;
            let value = NetUtil.readInputStreamToString(stream, stream.available());
            stream.seek(0, 0);
            return value;
        }
        else {
            let { listener } = modelFor(this);
            if(!listener.called && !listener.done) {
                throw "Content not yet received or overwritten";
            }
            else {
                return modelFor(this).listener.value;
            }
        }
    },
    set content(val) {
        if(modelFor(this).direction === OUTGOING) {
            let channel = channelFor(this);
            channel.QueryInterface(Ci.nsIUploadChannel);
            let stream = InputStream(val).stream;
            let type;
            try {
                type = channel.contentType;
            }
            catch(e) {
                type = "text/plain";
            }
            channel.setUploadStream(stream, type, stream.available());
        }
        else {
            modelFor(this).listener.value = val;
            modelFor(this).listener.called = true;
        }
    },
    get direction() {
        return modelFor(this).direction;
    },
    //TODO get chached()
    abort: function() {
        let channel = channelFor(this);
        channel.QueryInterface(Ci.nsIRequest);
        channel.cancel(Cr.NS_BINDING_ABORTED);
    },
    processContent: function(callback) {
        if(modelFor(this).direction === OUTGOING) {
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

