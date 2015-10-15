/**
 * @author Martin Giger
 * @license MPL-2.0
 * @module lib/inputstream
 * @requires external:is-typedarray
 */

/**
 * @typedef Content
 * @type {(external:sdk/io/buffer.Buffer|ArrayBuffer|TypedArray|string|external:nsIInputStream|module:lib/inputstream.InputStream|Object)?}
 */
/**
 * @external nsIInputStream
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIInputStream}
 */

"use strict";

const { Class } = require("sdk/core/heritage");
const { CC, Ci } = require("chrome");
const { Buffer } = require("sdk/io/buffer");
const { strict: isStrictTypedArray } = require("is-typedarray");

const StringInputStream = CC("@mozilla.org/io/string-input-stream;1",
                             "nsIStringInputStream");
const ArrayBufferInputStream = CC("@mozilla.org/io/arraybuffer-input-stream;1",
                                  "nsIArrayBufferInputStream");

const InputStream = Class(
/** @lends module:lib/inputstream.InputStream.prototype */
{
    /**
     * @constructs
     * @argument {module:lib/inputstream~Content?} data - Data to embed in the stream
     */
    initialize: function(data) {
        this.data = data;

        if(data instanceof Ci.nsIInputStream) {
            this.stream = data;
        }
        else if(data instanceof InputStream) {
            this.stream = data.stream;
        }
        else if(data instanceof ArrayBuffer) {
            this.stream = new ArrayBufferInputStream();
            this.stream.setData(data, 0, data.byteLength);
        }
        else if(Buffer.isBuffer(data) || isStrictTypedArray(data)) {
            this.stream = new ArrayBufferInputStream();
            this.stream.setData(data.buffer, 0, data.length);
        }
        else {
            this.stream = new StringInputStream();
            let string = data;
            if(data === null) {
                string = "";
            }
            else if(typeof data === "object") {
                string = JSON.stringify(data);
            }
            this.stream.setData(string, string.length);
        }
    },
    /**
     * @type {external:nsIInputStream?}
     */
    stream: null,
    /**
     * The data the stream was created from. Can be a stream, too.
     * @type {module:lib/inputstream~Content?}
     */
    data: null,
    /**
     * Byte length of the stream
     * @type {number}
     */
    get length() {
        return this.stream.available();
    }
});

exports.InputStream = InputStream;
