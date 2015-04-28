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
const { Ci, Cr } = require("chrome");
const { newURI } = require("sdk/url/utils");
const { InputStream } = require("./InputStream");
const { InputStream: ReadInputStream } = require("sdk/io/stream");

const INCOMING = 0;
const OUTGOING = 1;

let streams = new WeakMap();
let models = new WeakMap();

let streamFor = (oreq) => streams.get(oreq);
let modelFor = (oreq) => models.get(oreq);

//TODO verify constructor options

const OngoingRequest = Class({
    extends: Disposable,
    setup: function(options) {
        options.stream.QueryInterface(Ci.nsIHttpChannel);
        streams.set(this, options.stream);
        models.set(this, { direction: options.direction });
    },
    get url() {
        return streamFor(this).URI.spec;
    },
    set url(val) {
        if(modelFor(this).direction === OUTGOING) {
            streamFor(this).redirectTo(newURI(val));
        }
        else {
            console.warn("Cannot redirect an incoming request");
        }
    },
    get referrer() {
        return streamFor(this).referrer.spec;
    },
    set referrer(val) {
        if(modelFor(this).direction === OUTGOING) {
            streamFor(this).referrer = newURI(val);
        }
        else {
            console.warn("Cannot set the referrer of an incoming request");
        }
    },
    get method() {
        return streamFor(this).requestMethod;
    },
    set method(val) {
        if(modelFor(this).direction === OUTGOING) {
            streamFor(this).requestMethod = val;
        }
        else {
            console.warn("The request method can only be set for outgoing requests");
        }
    },
    get status() {
        if(modelFor(this).direction === INCOMING) {
            return streamFor(this).responseStatus;
        }
        else {
            console.warn("Status is unavailable for outgoing requests");
        }
    }
    get headers() {
        let visitor = {
            headers: {}
            visitHeader: function(header, value) {
                this.headers[header] = value;
            }
        };
        if(modelFor(this).direction === INCOMING) {
            streamFor(this).visitResponseHeaders(visitor);
        }
        else {
            streamFor(this).visitRequestHeaders(visitor);
        }
        return visitor.headers;
    },
    set headers(headers) {
        let stream = streamFor(this);
        let incoming = modelFor(this).direction === INCOMING;
        for(let h in val) {
            if(incoming) {
                stream.setResponseHeader(h, headers[h], false);
            }
            else {
                stream.setRequestHeader(h, headers[h], false);
            }
        }
    },
    get content() {
        throw "Not really implemented, sorry";
        if(modelFor(this).direction === OUTGOING) {
            stream.QueryInterface(Ci.nsIUploadChannel);
            //TODO do synchronous stream to buffer to string reading magic on
            //stream.uploadStream
        }
        else {
            //TODO this requires another observer due to how nsITraceableChannel works.
        }
    },
    set content(val) {
        let stream = streamFor(this);
        if(modelFor(this).direction === OUTGOING) {
            stream.QueryInterface(Ci.nsIUploadChannel);
            stream.setUploadStream(InputStream(val), null, val.length);
        }
        else {
            //TODO this requires another observer :S
        }
    },
    get direction() {
        return modelFor(this).direction;
    },
    abort: function() {
        streamFor(this).cancel(Cr.NS_BINDING_ABORTED);
    },
    dispose: function() {
        models.delete(this);
        streams.delete(this);
    }
});

exports.OngoingRequest = OngoingRequest;

