/**
 * Headers unit tests
 * @author Martin Giger
 * @license MPL-2.0
 */

"use strict";

const { Headers } = require("../lib/headers");
const { INCOMING, OUTGOING } = require("../lib/const");

let mockChannel = {
    direction: INCOMING,
    headers: {},
    _getHeader: function(header) {
        if(header in this.headers) return this.headers[header];
        throw "Header not set";
    },
    getRequestHeader: function(header) {
        if(this.direction !== OUTGOING) throw "Wrong direction";
        return this._getHeader(header);
    },
    getResponseHeader: function(header) {
        if(this.direction !== INCOMING) throw "Wrong direction";
        return this._getHeader(header);
    },
    _setHeader: function(header, value) {
        // not totally like the real function behaves, but close enough for now.
        // we don't test deleting inexistent values.
        if(value === "" && header in this.headers) {
            delete this.headers[header];
        }
        else {
            this.headers[header] = value;
        }
    },
    setRequestHeader: function(header, value) {
        if(this.direction !== OUTGOING) throw "Wrong direction";
        this._setHeader(header, value);
    },
    setResponseHeader: function(header, value) {
        if(this.direction !== INCOMING) throw "Wrong direction";
        this._setHeader(header, value);
    },
    _visitHeaders: function(visitor) {
        if("visitHeader" in visitor) {
            for(var h in this.headers) {
                visitor.visitHeader(h, this.headers[h]);
            }
        }
        else {
            throw "Invalid visitor";
        }
    },
    visitRequestHeaders: function(visitor) {
        if(this.direction !== OUTGOING) throw "Wrong direction";
        this._visitHeaders(visitor);
    },
    visitResponseHeaders: function(visitor) {
        if(this.direction !== INCOMING) throw "Wrong direction";
        this._visitHeaders(visitor);
    }
};

exports["test outgoing headers has"] = function(assert) {
    mockChannel.direction = OUTGOING;
    mockChannel.headers = {
        "Content-Type": "text/html",
        "x-custom": "asdf",
        "Accept": "*"
    };
    let headers = Headers(mockChannel, OUTGOING);

    assert.ok(headers.has("Content-Type"));
    assert.ok(headers.has("x-custom"));
    assert.ok(headers.has("Accept"));
    assert.ok(!headers.has("Accept-Encoding"));
    assert.ok(!headers.has("Method"));

    headers.destroy();
};

exports["test incoming headers has"] = function(assert) {
    mockChannel.direction = INCOMING;
    mockChannel.headers = {
        "Content-Type": "text/html",
        "x-custom": "asdf",
        "Accept": "*"
    };
    let headers = Headers(mockChannel, INCOMING);

    assert.ok(headers.has("Content-Type"));
    assert.ok(headers.has("x-custom"));
    assert.ok(headers.has("Accept"));
    assert.ok(!headers.has("Accept-Encoding"));
    assert.ok(!headers.has("Method"));

    headers.destroy();
};

exports["test outgoing headers get"] = function(assert) {
    mockChannel.direction = OUTGOING;
    mockChannel.headers = {
        "Content-Type": "text/html",
        "x-custom": "asdf",
        "Accept": "*"
    };
    let headers = Headers(mockChannel, OUTGOING);

    assert.equal(headers.get("Content-Type"), "text/html");
    assert.equal(headers.get("x-custom"), "asdf");
    assert.equal(headers.get("Accept"), "*");
    assert.equal(headers.get("Accept-Encoding"), undefined);
    assert.equal(headers.get("Method"), undefined);

    headers.destroy();
};

exports["test incoming headers get"] = function(assert) {
    mockChannel.direction = INCOMING;
    mockChannel.headers = {
        "Content-Type": "text/html",
        "x-custom": "asdf",
        "Accept": "*"
    };
    let headers = Headers(mockChannel, INCOMING);

    assert.equal(headers.get("Content-Type"), "text/html");
    assert.equal(headers.get("x-custom"), "asdf");
    assert.equal(headers.get("Accept"), "*");
    assert.equal(headers.get("Accept-Encoding"), undefined);
    assert.equal(headers.get("Method"), undefined);

    headers.destroy();
};

exports["test outgoing headers set"] = function(assert) {
    mockChannel.direction = OUTGOING;
    mockChannel.headers = {
        "Content-Type": "text/html"
    };
    let headers = Headers(mockChannel, OUTGOING);

    headers.set("Content-Type", "application/json");
    assert.equal(headers.get("Content-Type"), "application/json", "Existing outgoing header set successfully");

    headers.set("New-Header", "lorem ipsum");
    assert.equal(headers.get("New-Header"), "lorem ipsum", "New outgoing header set successfully");

    headers.destroy();
};

exports["test incoming headers set"] = function(assert) {
    mockChannel.direction = INCOMING;
    mockChannel.headers = {
        "Content-Type": "text/html"
    };
    let headers = Headers(mockChannel, INCOMING);

    headers.set("Content-Type", "application/json");
    assert.equal(headers.get("Content-Type"), "application/json", "Existing incoming header set successfully");

    headers.set("New-Header", "lorem ipsum");
    assert.equal(headers.get("New-Header"), "lorem ipsum", "New incoming header set successfully");

    headers.destroy();
};

exports["test outgoing headers delete"] = function(assert) {
    mockChannel.direction = OUTGOING;
    mockChannel.headers = {
        "Content-Type": "text/html"
    };
    let headers = Headers(mockChannel, OUTGOING);

    headers.delete("Content-Type");
    assert.ok(!headers.has("Content-Type"), "Outgoing header deleted");

    headers.destroy();
};

exports["test incoming headers delete"] = function(assert) {
    mockChannel.direction = INCOMING;
    mockChannel.headers = {
        "Content-Type": "text/html"
    };
    let headers = Headers(mockChannel, INCOMING);

    headers.delete("Content-Type");
    assert.ok(!headers.has("Content-Type"), "Incoming header deleted");

    headers.destroy();
};

exports["test outgoing headers forEach"] = function(assert) {
    mockChannel.direction = OUTGOING;
    mockChannel.headers = {
        "Content-Type": "text/html",
        "x-custom": "asdf",
        "Accept": "*"
    };
    let headers = Headers(mockChannel, OUTGOING);

    let count = 0;
    headers.forEach(function(header, value) {
        ++count;
        assert.equal(mockChannel.headers[header], value);
    });

    assert.equal(count, 3, "Each header has been visited");

    headers.destroy();
};

exports["test incoming headers forEach"] = function(assert) {
    mockChannel.direction = INCOMING;
    mockChannel.headers = {
        "Content-Type": "text/html",
        "x-custom": "asdf",
        "Accept": "*"
    };
    let headers = Headers(mockChannel, INCOMING);

    let count = 0;
    headers.forEach(function(header, value) {
        ++count;
        assert.equal(mockChannel.headers[header], value);
    });

    assert.equal(count, 3, "Each header has been visited");

    headers.destroy();
};

exports["test outgoing headers iterator"] = function(assert) {
    mockChannel.direction = OUTGOING;
    mockChannel.headers = {
        "Content-Type": "text/html",
        "x-custom": "asdf",
        "Accept": "*"
    };
    let headers = Headers(mockChannel, OUTGOING);

    assert.ok(Symbol.iterator in headers, "Headers implements the iterable protocol");
    assert.ok("next" in headers[Symbol.iterator](), "The iterable from headers implements all nexessary properties");

    let count = 0;
    for(let header of headers) {
        ++count;
        assert.equal(mockChannel.headers[header.header], header.value);
    }

    assert.equal(count, 3, "Each header has been iterated over");

    headers.destroy();
};

exports["test incoming headers iterator"] = function(assert) {
    mockChannel.direction = INCOMING;
    mockChannel.headers = {
        "Content-Type": "text/html",
        "x-custom": "asdf",
        "Accept": "*"
    };
    let headers = Headers(mockChannel, INCOMING);

    assert.ok(Symbol.iterator in headers, "Headers implements the iterable protocol");
    assert.ok("next" in headers[Symbol.iterator](), "The iterable from headers implements all nexessary properties");

    let count = 0;
    for(let header of headers) {
        ++count;
        assert.equal(mockChannel.headers[header.header], header.value);
    }

    assert.equal(count, 3, "Each header has been iterated over");

    headers.destroy();
};

require("sdk/test").run(exports);
