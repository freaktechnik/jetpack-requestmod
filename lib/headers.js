/**
 * Headers accessor for an ongoing request.
 * @author Martin Giger
 * @license MPL-2.0
 * @module lib/headers
 */

"use strict";

const { Class } = require("sdk/core/heritage");
const { Disposable } = require("sdk/core/disposable");
const { INCOMING, OUTGOING } = require("./const");

let channels = new WeakMap();
let channelFor = (headers) => channels.get(headers);


const Headers = Class({
    implements: [ Disposable ],
    setup: function(channel, direction) {
        channels.set(this, channel);
        this.direction = direction;
    },
    get: function(header) {
        try {
            if(this.direction === OUTGOING) {
                return channelFor(this).getRequestHeader(header);
            }
            else {
                return channelFor(this).getResponseHeader(header);
            }
        }
        catch(e) {
            return undefined;
        }
    },
    has: function(header) {
        return this.get(header) !== undefined;
    },
    set: function(header, value) {
        if(this.direction === OUTGOING) {
            channelFor(this).setRequestHeader(header, value, false);
        }
        else {
            channelFor(this).setResponseHeader(header, value, false);
        }
    },
    delete: function(header) {
        this.set(header, "");
    },
    forEach: function(callback, thisArg = null) {
        let visitor = {
            visitHeader: (header, value) => {
                callback.call(thisArg, header, value);
            }
        };
        if(this.direction === INCOMING) {
            channelFor(this).visitResponseHeaders(visitor);
        }
        else {
            channelFor(this).visitRequestHeaders(visitor);
        }
    },
    [Symbol.iterator]: function() {
        let headers = [];
        this.forEach((header, value) => {
            headers.push({header: header, value: value});
        });

        return headers[Symbol.iterator]();
    },
    dispose: function() {
        channels.delete(this);
    }
});

exports.Headers = Headers;
