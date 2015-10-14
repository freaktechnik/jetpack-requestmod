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
    const testString = "Lorem ipsum";
    let { stream } = InputStream(testString);

    let content = NetUtil.readInputStreamToString(stream, stream.available(), {});

    assert.equal(content, testString, "Stream correctly set");
};

exports.testStringStreamObject = function(assert) {
    const testObject = {
        a: "b",
        hallo: [
            "a",
            2
        ],
        test: 2
    };
    let { stream } = InputStream(testObject);

    let content = NetUtil.readInputStreamToString(stream, stream.available(), {});

    assert.equal(content, JSON.stringify(testObject), "Stream correctly set");
    assert.ok(objectEqual(JSON.parse(content), testObject), "Object correctly serialized");
};

exports.testStreamStream = function(assert) {
    const { stream: testStream } = InputStream("foo bar");

    let { stream } = InputStream(testStream);

    assert.equal(stream, testStream, "Same stream");
};

exports.testInputStreamStream = function(assert) {
    const testStream = InputStream("foo bar");

    let stream = InputStream(testStream);

    assert.equal(stream.data, testStream, "Data of the new stream is the previous input stream");

    assert.equal(stream.stream, testStream.stream, "Same stream");
};

//TODO test buffer

require("sdk/test").run(exports);
