/**
 * Headers accessor for an ongoing request.
 * @author Martin Giger
 * @license MPL-2.0
 * @module lib/headers
 */

"use strict";

const { Class } = require("sdk/core/heritage");
/**
 * @external sdk/core/disposable
 * @requires sdk/core/disposable
 */
/**
 * An SDK class that handles unloading
 * @class Disposable
 * @memberof external:sdk/core/disposable
 */
const { Disposable } = require("sdk/core/disposable");
const { INCOMING, OUTGOING } = require("./const");

let channels = new WeakMap();
let channelFor = (headers) => channels.get(headers);

const Headers = Class(
/** @lends module:lib/headers.Headers.prototype */
{
    implements: [ Disposable ],
    /**
     * @typedef HeaderTuple
     * @property {string} header - Name of the header
     * @property {string} value - Value of the header
     */
    /**
     * Headers is an object to access and modify headers of a request. It
     * implements an interface similar to the JS Map object. It also implements
     * the iterable protocol, so you can iterate over it with for...of loops.
     * Each value when iterating is a {@link module:lib/headers~HeaderTuple}.
     * @constructs
     * @extends external:sdk/core/disposable.Disposable
     * @argument {external:nsIHttpChannel} channel
     * @argument {module:lib/const~Direction} direction
     */
    setup: function(channel, direction) {
        channels.set(this, channel);
        this.direction = direction;
    },
    /**
     * Gets the value of the specified header.
     * @argument {string} header - (case sensitive) header name
     * @return {string|undefined} returns `undefined` if the header is not set.
     */
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
    /**
     * Check if a header is set.
     * @argument {string} header - (case sensitive) header name
     * @return {boolean}
     */
    has: function(header) {
        return this.get(header) !== undefined;
    },
    /**
     * Sets the value of the specified header. Replaces the existing value or
     * creates a new header if a header with the given name doesn't exist yet.
     * @argument {string} header - (case sensitive) header name
     * @argument {string} value - Value to set the header to
     */
    set: function(header, value) {
        if(this.direction === OUTGOING) {
            channelFor(this).setRequestHeader(header, value, false);
        }
        else {
            channelFor(this).setResponseHeader(header, value, false);
        }
    },
    /**
     * Removes a header from the request.
     * @argument {string} header - (case sensitive) header name
     */
    delete: function(header) {
        this.set(header, "");
    },
    /**
     * @callback forEachCallback
     * @argument {string} header - Name of the header
     * @argument {string} value - Value of the header
     */
    /**
     * Iterates over every set header.
     * @argument {module:headers~forEachCallback} callback
     * @argument {Object} thisArg
     */
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
