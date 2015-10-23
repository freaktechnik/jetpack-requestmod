/**
 * Listener for a traceable channel
 * @author Martin Giger
 * @license MPL-2.0
 * @module lib/channellistener
 */

"use strict";

const { Class } = require("sdk/core/heritage");
/**
 * @external sdk/platform/xpcom
 * @requires sdk/platform/xpcom
 * @see {@link https://developer.mozilla.org/en-US/Add-ons/SDK/Low-Level_APIs/platform_xpcom}
 */
/**
 * An SDK class that implements nsISupports.
 * @class Unknown
 * @memberof external:sdk/platform/xpcom
 * @implements external:nsISupports
 * @see {@link https://developer.mozilla.org/en-US/Add-ons/SDK/Low-Level_APIs/platform_xpcom#Unknown}
 */
const { Unknown } = require("sdk/platform/xpcom");
const { InputStream } = require("./inputstream");
const { NetUtil } = require("resource://gre/modules/NetUtil.jsm");

const Listener = Class(
/** @lends module:lib/channellistener.ChannelListener.prototype */
{
    extends: Unknown,
    interfaces: [ 'nsIStreamListener' ],
    _called: false,
    _value: "",
    /**
     * The request body that is beim streamed.
     * @type {string}
     */
    get value() {
        return this._value;
    },
    set value(val) {
        this._value = val;
        this._called = true;
    },
    /**
     * Indicates if the value has been set by the user, or if it's still the
     * incoming value.
     * @type {boolean}
     * @readonly
     */
    get called() {
        return this._called;
    },
    oldListener: null,
    done: false,
    processor: null,
    /**
     * @constructs
     * @extends external:sdk/platform/xpcom.Unknown
     * @implements external:nsIStreamListener
     */
    initialize: function() {
        this._value = "";
    },
    onStartRequest: function(request, context) {
        this.oldListener.onStartRequest(request, context);
    },
    onDataAvailable: function(request, context, inputStream, offset, count) {
        if(!this.called) {
            this._value += NetUtil.readInputStreamToString(inputStream, count);
        }
    },
    onStopRequest: function(request, context, status) {
        if(this.processor !== null) {
            this.value = this.processor(this.value);
        }

        let stream = InputStream(this.value);

        this.oldListener.onDataAvailable(request, context, stream.stream, 0, stream.length);
        this.oldListener.onStopRequest(request, context, status);
        this.done = true;
    }
});
exports.ChannelListener = Listener;
