/**
 * Listener for a traceable channel
 * @author Martin Giger
 * @license MPL-2.0
 * @module lib/channellistener
 */

"use strict";

const { Class } = require("sdk/core/heritage");
const { Unknown } = require("sdk/platform/xpcom");
const { InputStream } = require("./inputstream");
const { NetUtil } = require("resource://gre/modules/NetUtil.jsm");

const Listener = Class({
    extends: Unknown,
    interfaces: [ 'nsIStreamListener' ],
    called: false,
    value: "",
    oldListener: null,
    done: false,
    processor: null,
    initialize: function() {
        this.value = "";
    },
    onStartRequest: function(request, context) {
        this.oldListener.onStartRequest(request, context);
    },
    onDataAvailable: function(request, context, inputStream, offset, count) {
        if(!this.called) {
            this.value += NetUtil.readInputStreamToString(inputStream, count);
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
