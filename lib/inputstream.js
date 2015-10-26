/**
 * @author Martin Giger
 * @license MPL-2.0
 * @module lib/inputstream
 * @requires external:is-typedarray
 */

/**
 * @typedef Content
 * @type {(external:sdk/io/buffer.Buffer|ArrayBuffer|TypedArray|string|Object)}
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
const { NetUtil } = require("resource://gre/modules/NetUtil.jsm");

const ArrayBufferInputStream = CC("@mozilla.org/io/arraybuffer-input-stream;1",
                                  "nsIArrayBufferInputStream", "setData");
const StringInputStream = CC("@mozilla.org/io/string-input-stream;1",
                             "nsIStringInputStream", "setData");
const StorageStream = CC("@mozilla.org/storagestream;1", "nsIStorageStream",
                         "init");
const Converter = CC("@mozilla.org/intl/scriptableunicodeconverter",
                     "nsIScriptableUnicodeConverter");
const BinaryInputStream = CC("@mozilla.org/binaryinputstream;1",
                             "nsIBinaryInputStream", "setInputStream");
const BinaryOutputStream = CC("@mozilla.org/binaryoutputstream;1",
                              "nsIBinaryOutputStream", "setOutputStream");

const STORAGE_BLOCK_SIZE = 8192;

const InputStream = Class(
/** @lends module:lib/inputstream.InputStream.prototype */
{
    /**
     * @typedef {Object} InputStreamOptions
     * @property {string} [charset="UTF-8"]
     * @property {number} [size]
     */
    /**
     * What this doesn't do: handle streams longer than an unsigned long.
     * @constructs
     * @argument {external:nsIInputStream|module:lib/inputstream.InputStream|
     *  module:lib/inputstream~Content?} data - Data to embed in the stream
     * @argument {module:lib/inputstream~InputStreamOptions} [options={charset:"UTF-8"}]
     */
    initialize: function(data, options = { charset: "UTF-8" }) {
        var stream, size;
        if("size" in options)
            size = options.size;

        if(data instanceof Ci.nsIInputStream) {
            if(data instanceof Ci.nsICloneableInputStream) {
                if(!size)
                    size = data.clone().available();
                this.data = data.clone();
            }
            else {
                if(!size)
                    size = data.available();
                this.data = data;
            }
            stream = data;
        }
        else if(data instanceof InputStream) {
            this.data = data.data;
            size = data.length;
            stream = data.stream;
        }
        else if(data instanceof ArrayBuffer) {
            this.data = data;
            size = data.byteLength;
            this.stream = new ArrayBufferInputStream(data, 0, data.byteLength);
        }
        else if(Buffer.isBuffer(data) || isStrictTypedArray(data)) {
            this.data = data;
            size = data.length;
            this.stream = new ArrayBufferInputStream(data.buffer, 0, data.length);
        }
        else {
            let string = data;
            if(data === null) {
                string = "";
            }
            else if(typeof data === "object") {
                string = JSON.stringify(data);
            }
            this.data = data;
            if("charset" in options) {
                let converter = new Converter();
                converter.charset = options.charset;
                stream = converter.convertToInputStream(string);
            }
            else {
                stream = new StringInputStream(string, string.length);
            }
            size = stream.available();
        }
        let storageSize = STORAGE_BLOCK_SIZE;
        if(size < storageSize)
            storageSize = Math.pow(2, Math.ceil(Math.log2(size)));
        if(storageSize == 0)
            storageSize = 1;

        this._storage = new StorageStream(storageSize, size);
        if(size > 0) {
            let iStream = new BinaryInputStream(stream);
            let oStream = new BinaryOutputStream(this._storage.getOutputStream(0));
            oStream.writeBytes(iStream.readBytes(size), size);

            if(this.data instanceof Ci.nsIInputStream)
                this.data = NetUtil.readInputStreamToString(this.stream, this.length, options);
        }
        else if(this.data instanceof Ci.nsIInputStream) {
            this.data = null;
        }
    },
    /**
     * @type {external:nsIInputStream?}
     * @readonly
     */
    get stream() {
        return this._storage.newInputStream(0);
    },
    /**
     * Sometimes the nsIInputStream needs to implement AddRef and Release,
     * which the nsStorageStream sadly doesn't, but nsIStringInputStream does.
     * @type {external:nsIInputStream?}
     * @readonly
     */
    get stringStream() {
        var string;
        if(this.length)
            string = NetUtil.readInputStreamToString(this.stream, this.length);
        else
            string = "";
        return new StringInputStream(string, string.length);
    },
    /**
     * The data the stream was created from. Can be a stream, too.
     * @type {module:lib/inputstream~Content?}
     */
    data: null,
    /**
     * Byte length of the stream
     * @type {number}
     * @readonly
     */
    get length() {
        return this._storage.length;
    }
});

exports.InputStream = InputStream;
