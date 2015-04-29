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
const { CC, Ci, Cr } = require("chrome");
const { newURI } = require("sdk/url/utils");
const { InputStream } = require("./inputstream");
const { InputStream: ReadInputStream } = require("sdk/io/stream");
const { contract } = require("sdk/util/contract");
const ScriptableInputStream = CC("@mozilla.org/scriptableinputstream;1", "nsIScriptableInputStream", "init");

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
    onStartRequest: function(request, context) {
        this.context = context;
        this.oldListener.onStartRequest(request, context);
    },
    onDataAvailable: function(request, context, inputStream, offset, count) {
        if(!this.called) {
            this.value += ScriptableInputStream(inputStream).read(count);
        }
        this.context = context;
    },
    onStopRequest: function(request, context, status) {
        this.oldListener.onDataAvailable(request, context, InputStream(this.value), 0, this.value.length);
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
        let channel = channelFor(this);
        if(modelFor(this).direction === OUTGOING) {
            channel.QueryInterface(Ci.nsIUploadChannel);
            let stream = new ScriptableInputStream(channel.uploadStream);
            let value = stream.read(channel.contentLength);
            stream.close();
            return value;
        }
        else {
            //TODO verify this is the full value and not just from some arbitrary async point in the request on.
            return modelFor(this).listener.value;
        }
    },
    set content(val) {
        if(modelFor(this).direction === OUTGOING) {
            let channel = channelFor(this);
            channel.QueryInterface(Ci.nsIUploadChannel);
            channel.setUploadStream(InputStream(val), null, val.length);
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
    dispose: function() {
        if(modelFor(this).listener) {
            let { listener } = modelFor(this);
            let channel = channelFor(this);
            if(!listener.done) {
                //TODO bbrokeen
                //listener.oldListener.onDataAvailable(channel, listener.context, InputStream(listener.value), 0, listener.value.length);
            }
            // this might result in garbage, if the request isn't closed yet.
            channel.setNewListener(listener.oldListener);
        }

        models.delete(this);
        channels.delete(this);
    }
});

exports.OngoingRequest = OngoingRequest;

