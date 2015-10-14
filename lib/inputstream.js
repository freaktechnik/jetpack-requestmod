/*
 * InputStream by Martin Giger
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const { Class } = require("sdk/core/heritage");
const { CC } = require("chrome");
const { Buffer } = require("sdk/io/buffer");

const StringInputStream = CC("@mozilla.org/io/string-input-stream;1",
                             "nsIStringInputStream");
const ArrayBufferInputStream = CC("@mozilla.org/io/arraybuffer-input-stream;1",
                                  "nsIArrayBufferInputStream");

const InputStream = Class({
    initialize: function(data) {
        this.data = data;

        if(Buffer.isBuffer(data)) {
            this.stream = new ArrayBufferInputStream();
            this.stream.setData(data, 0, data.length);
        }
        else {
            this.stream = new StringInputStream();
            let string = data;
            if(typeof data === "object") {
                string = JSON.stringify(data);
            }
            this.stream.setData(string, string.length);
        }
    }
});

exports.InputStream = InputStream;
