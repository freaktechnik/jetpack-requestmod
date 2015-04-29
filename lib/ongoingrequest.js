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

const OngoingRequest = Class({
    extends: Disposable,
    setup: function(options) {
        requestContract(options);
        // In theory the contract already did this check
        options.channel.QueryInterface(Ci.nsIHttpChannel);

        channels.set(this, options.channel);
        models.set(this, { direction: options.direction });
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
            //TODO this requires another observer due to how nsITraceableChannel works.
        }
    },
    set content(val) {
        let channel = channelFor(this);
        let inputStream = InputStream(val);
        if(modelFor(this).direction === OUTGOING) {
            channel.QueryInterface(Ci.nsIUploadChannel);
            channel.setUploadStream(inputStream, null, val.length);
        }
        else {
            // this method only works once and breaks afterwards (because of the listener chaining).
            // further I am not sure if this really works, but it should. Maybe.
            // I prefer the uplaodChannel interface.
            channel.QueryInterface(Ci.nsITraceableChannel);
            let oldListener = null;
            let listener = {
                called: false,
                onStartRequest: function(...args) {
                    oldListener.onStartRequest(...args);
                },
                onDataAvailable: function(request, context, aInputStream, offset, count) {
                    if(!this.called) {
                        this.called = true;
                        oldListener.onDataAvailable(request, context, inputStream, 0, val.length);
                    }
                },
                onStopRequest: function(...args) {
                    oldListener.onStopRequest(...args);
                }
            };
            oldListener = channel.setNewListener(listener);
        }
    },
    get direction() {
        return modelFor(this).direction;
    },
    abort: function() {
        let channel = channelFor(this);
        channel.QueryInterface(Ci.nsIRequest);
        channel.cancel(Cr.NS_BINDING_ABORTED);
    },
    dispose: function() {
        models.delete(this);
        channels.delete(this);
    }
});

exports.OngoingRequest = OngoingRequest;

