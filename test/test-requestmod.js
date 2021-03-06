/*
 * Unit Tests for RequestMod by Martin Giger
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const { Request } = require("sdk/request");
const { RequestMod } = require("../lib/requestmod");
const { startServerAsync } = require("./httpd");
const { when } = require("sdk/event/utils");
const { before, after } = require("sdk/test/utils");
const { InputStream } = require("../lib/inputstream");

// Set up the server
const CONTENT = "<h1>Test</h1>";
var PORT, ROOT, srv;
let startServer = () => {
    srv = startServerAsync(-1);
    srv.registerPathHandler("/", function(request, response) {
        response.processAsync();
        response.setHeader('Content-Type', 'text/html', false);
        response.write(CONTENT);
        response.finish();
    });

    srv.registerPathHandler("/echo/", function(request, response) {
        response.processAsync();
        response.setHeader('Content-Type', 'application/json', false);
        let obj = {};
        obj.content = (new InputStream(request.bodyInputStream)).data;
        let headers = {}, h = request.headers, s;
        while(h.hasMoreElements()) {
            s = h.getNext().toString();
            headers[s] = request.getHeader(s);
        }
        obj.headers = headers;
        obj.method = request.method;

        response.write(JSON.stringify(obj));
        response.finish();
    });
    srv.registerPathHandler("/test-image.png", function(request, response) {
        response.processAsync();
        response.setHeader("Content-Type", "image/png", false);
        var r = Request({
            url: module.uri.replace(/[^\.\\\/]*\.js$/, "test-image.png"),
            onComplete: (res) => {
                response.write(res.text);
                response.finish();
            }
        });
        r.get();
    });

    PORT = srv.identity.primaryPort;
    ROOT = 'http://localhost:'+PORT+'/';
};

// end of server setup

exports['test contract'] = function(assert) {
    assert.throws(() => {
        RequestMod({
            url: 9,
            direction: [ RequestMod.OUTGOING ],
            requestHandler: () => {}
        });
    },
    "Contract complains about invalid URL pattern");

    assert.throws(() => {
        RequestMod({
            url: 'http://example.com',
            direction: RequestMod.INCOMING,
            requestHandler: () => {}
        });
    },
    "Contract complains about invalid direction");

    assert.throws(() => {
        RequestMod({
            url: 'http://example.com/',
            direction: [ RequestMod.OUTGOING, RequestMod.INCOMING ],
            requestHandler: null
        });
    },
    "Contract complains about requestHandler");
};

exports['test constants'] = function(assert) {
    const { INCOMING, OUTGOING } = require("../lib/const");
    assert.equal(INCOMING, RequestMod.INCOMING, "The constant for incoming requests matches.");
    assert.equal(OUTGOING, RequestMod.OUTGOING, "The constant for outgoing requests matches.");
};

exports['test outgoing'] = function*(assert) {
    var r = Request({
        url: ROOT + "echo/",
        content: "test"
    });
    var mod = RequestMod({
        url: 'http://localhost*',
        direction: [ RequestMod.OUTGOING ],
        requestHandler: function(req) {
            assert.equal(req.url, r.url, "URL property works correctly");
            assert.equal(req.method, 'POST', "Method matches");
            assert.equal(req.direction, RequestMod.OUTGOING, "Direction is correct");
            assert.equal(req.referer, "", "Referer is matching");
            assert.throws(() => req.status, "Cannot get status of an outgoing request");
            assert.equal(req.content, "test", "Content read correctly");
            assert.equal(req.type, "application/x-www-form-urlencoded", "Content type is correct");
            assert.throws(() => req.notCached, "notCached throws for outgoing requests");

            req.content = "tset";
            req.referer = "http://humanoids.be/";
            req.method = 'PUT';
            req.headers.set("x-something", "adsf");

            assert.equal(req.content, "tset", "Setting content is immediate");
            assert.equal(req.referer, "http://humanoids.be/", "Setting referrer is immediate");
            assert.equal(req.method, "PUT", "Setting method is immediate");
            assert.ok(req.headers.has("x-something"), "Header is set immediately");
        }
    });

    r.post();

    let res = yield when(r, "complete");

    assert.equal(res.json.content, "tset", "Successfully changed request content");
    assert.equal(res.json.method, "PUT", "Successfully changed request method");
    assert.equal(res.json.headers.referer, "http://humanoids.be/", "Successfully changed referer");
    assert.equal(res.json.headers["x-something"], "adsf", "Successfully added a request header");

    mod.destroy();
};

exports['test incoming'] = function*(assert) {
    var r = Request({
        url: ROOT
    });
    var mod = RequestMod({
        url: 'http://localhost*',
        direction: [ RequestMod.INCOMING ],
        requestHandler: function(req) {
            assert.equal(req.url, r.url, "URL property matches the one of the request");
            assert.equal(req.method, 'GET', "Method matches");
            assert.equal(req.direction, RequestMod.INCOMING, "Direction is correct");
            assert.equal(req.referer, "", "Referer is matching");
            assert.equal(req.status, 200, "Status code is correct");
            assert.equal(req.charset, "");
            assert.equal(req.type, "text/html", "Response content type correct");
            assert.equal(req.notCached, null, "Response cache status correct");
            req.processContent((content) => {
                assert.equal(content, CONTENT);
                return "foo";
            });

            assert.throws(() => { req.method = 'POST'; }, "Cannot set method if an incoming request");
            assert.throws(() => { req.referer = 'http://humanoids.be'; }, "Cannot set referrer of an incoming request");
            assert.throws(() => { req.url = 'http://humanoids.be'; }, "Cannot set url of an incoming request");
            req.headers.set("X-Something", "asdf");
            //req.type = "text/plain";
            req.charset = "UTF-8";
        }
    });

    r.get();

    let result = yield when(r, "complete");

    assert.equal(result.headers["X-Something"], "asdf", "Successfully added a response header");
    assert.equal(result.text, "foo", "Successfully changed response content");
    assert.equal(result.headers["Content-Type"], "text/html");
    mod.destroy();
};

exports['test abort outgoing'] = function*(assert) {
    var r = Request({
        url: ROOT
    });
    var mod = RequestMod({
        url: 'http://localhost*',
        direction: [ RequestMod.OUTGOING ],
        requestHandler: function(req) {
            req.abort();
        }
    });

    r.get();

    yield when(r, "complete");

    assert.equal(r.response.status, 0, "Request has been aborted");
    mod.destroy();
};

exports['test abort incoming'] = function*(assert) {
    var r = Request({
        url: ROOT
    });
    var mod = RequestMod({
        url: 'http://localhost*',
        direction: [ RequestMod.INCOMING ],
        requestHandler: function(req) {
            req.abort();
        }
    });

    r.get();

    yield when(r, "complete");

    assert.equal(r.response.status, 0, "Request has been aborted");
    mod.destroy();
};

exports['test redirect'] = function*(assert) {
    var r = Request({
        url: ROOT + "echo/"
    });
    var mod = RequestMod({
        url: 'http://localhost*',
        direction: [ RequestMod.OUTGOING ],
        requestHandler: function(req) {
            // We will get the request again after the redirect!
            if(req.url != ROOT)
                req.url = ROOT;
        }
    });

    r.get();

    let res = yield when(r, "complete");

    assert.equal(res.text, CONTENT, "Request successfully redirected");
    mod.destroy();
};

exports['test null content'] = function*(assert) {
    var r = Request({
        url: ROOT,
        content: "test"
    });

    var mod = RequestMod({
        url: 'http://localhost*',
        direction: [ RequestMod.OUTGOING ],
        requestHandler: function(req) {
            assert.equal(req.content, "test", "Content read correctly");
            req.content = null;
            assert.equal(req.content, null, "Content correctly set to null");
            //TODO fix requests with their content set to null never completing. See #2
            req.content = "test";
        }
    });

    let p = when(r, "complete");
    r.post();
    yield p;

    mod.destroy();
};

exports['test POST method not reset'] = function*(assert) {
    var r = Request({
        url: ROOT
    });
    var mod = RequestMod({
        url: 'http://localhost*',
        direction: [ RequestMod.OUTGOING ],
        requestHandler: function(req) {
            assert.equal(req.method, "POST", "Method is POST to begin with");
            req.content = "test";
            assert.equal(req.method, "POST", "Method is still POST after changing the content");
        }
    });

    r.post();
    yield when(r, "complete");

    mod.destroy();
};

exports['test PUT method not reset'] = function*(assert) {
    var r = Request({
        url: ROOT
    });
    var mod = RequestMod({
        url: 'http://localhost*',
        direction: [ RequestMod.OUTGOING ],
        requestHandler: function(req) {
            assert.equal(req.method, "PUT", "Method is PUT to begin with");
            req.content = "test";
            assert.equal(req.method, "PUT", "Method is still PUT after changing the content");
        }
    });

    r.put();
    yield when(r, "complete");

    mod.destroy();
};

exports['test incoming image'] = function*(assert) {
    var testImageURL = ROOT + "test-image.png";

    var unmodifiedRequest = Request({
        url: testImageURL
    });
    unmodifiedRequest.get();
    let unmodifiedResult = yield when(unmodifiedRequest, "complete");

    var r = Request({
        url: testImageURL
    });
    var content;
    var mod = RequestMod({
        url: testImageURL,
        direction: [ RequestMod.INCOMING ],
        requestHandler: (req) => {
            assert.equal(req.type, "image/png");
            req.processContent((c) => {
                content = c;
                return c;
            });
        }
    });

    r.get();
    let res = yield when(r, "complete");
    mod.destroy();

    //TODO there is some encoding problem with content.
    //assert.equal(res.text, content, "Image content is still the same");

    assert.equal(res.text, unmodifiedResult.text, "Image content is the same with and without request mod");
};

//TODO test contracts

before(exports, (name, assert) => {
    startServer();
});
after(exports, (name, assert, done) => {
    srv.stop(done);
});

require("sdk/test").run(exports);
