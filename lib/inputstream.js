/*
 * InputStream by Martin Giger
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
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

const InputStream = Class({
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
    get length() {
        return this.stream.available();
    }
});

exports.InputStream = InputStream;
