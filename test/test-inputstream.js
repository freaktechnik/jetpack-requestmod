/**
 * Tests for the inputstream module
 * @author Martin Giger
 * @license MPL-2.0
 */

"use strict";

const { NetUtil } = require("resource://gre/modules/NetUtil.jsm");
const { InputStream } = require("../lib/inputstream");

function objectEqual(a, b) {
    let result = true;
    for(let h in a) {
        if(h in b) {
            if(typeof a[h] === "object")
                result = result && objectEqual(a[h], b[h]);
            else
                result = result && a[h] == b[h];
        }
        else {
            return false;
        }
    }

    return result;
}

exports.testStringStream = function(assert) {
    const testString = "Lörem ïpsum";
    let { stream, length } = InputStream(testString, {
        charset: "UTF-8"
    });

    assert.equal(length, stream.available());

    let content = NetUtil.readInputStreamToString(stream, length, {
        charset: "UTF-8"
    });

    assert.equal(content, testString, "Stream correctly set");
};

exports.testStringStreamObject = function(assert) {
    const testObject = {
        a: "b",
        hallo: [
            "ä",
            2
        ],
        test: 2
    };
    let { stream, data, length } = InputStream(testObject, {
        charset: "UTF-8"
    });

    assert.equal(length, stream.available());

    let content = NetUtil.readInputStreamToString(stream, length, {
        charset: "UTF-8"
    });

    assert.equal(content, JSON.stringify(testObject), "Stream correctly set");
    assert.ok(objectEqual(JSON.parse(content), testObject), "Object correctly serialized");
    assert.ok(objectEqual(data, testObject));
};

exports.testStreamStream = function(assert) {
    const testStream = InputStream("foo bar");

    let stream = InputStream(testStream.stream);

    assert.equal(testStream.length, stream.length, "Same length");
    assert.equal(testStream.data, stream.data, "Same data");
    assert.equal(stream.length, stream.stream.available());
};

exports.testInputStreamStream = function(assert) {
    const testStream = InputStream("foo bar");

    let stream = InputStream(testStream);

    assert.equal(stream.data, testStream.data, "Data of the new stream is the same");

    assert.notEqual(stream.stream, testStream.stream, "Different streams");
    assert.equal(stream.length, testStream.length, "Same length");
};

//TODO test null
//TODO test buffer

require("sdk/test").run(exports);
