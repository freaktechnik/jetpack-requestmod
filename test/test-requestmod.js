/*
 * RequestMod by Martin Giger
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 */

const { Request } = require("sdk/request");
const { RequestMod } = require("../lib/requestmod");
const { startServerAsync } = require("./httpd");
const { CC } = require("chrome");
const ScriptableInputStream = CC("@mozilla.org/scriptableinputstream;1", "nsIScriptableInputStream", "init");

const CONTENT = "<h1>Test</h1>";
let srv = startServerAsync(-1);
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
    obj.content = new ScriptableInputStream(request.bodyInputStream).read(4);
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

const PORT = srv.identity.primaryPort;
const ROOT = 'http://localhost:'+PORT+'/';

exports['test contract'] = function(assert) {
    assert.throws(() => {
        RequestMod({
            url: 9,
            direction: [ RequestMod.OUTGOING ],
            requestHandler: () => {}
        });
    }, "The `url` option must always contain atleast one rule as a string, regular expression, or an array of strings and regular expressions.");

    assert.throws(() => {
        RequestMod({
            url: 'http://example.com',
            direction: RequestMod.INCOMING,
            requestHandler: () => {}
        });
    }, 'The `direction` option must always be an array with at least one item and each item must have the value of a direction constant.');

    assert.throws(() => {
        RequestMod({
            url: 'http://example.com/',
            direction: [ RequestMod.OUTGOING, RequestMod.INCOMING ],
            requestHandler: null
        });
    }, 'The `requestHandler` option must alwys be a function.');
};

exports['test outgoing'] = function(assert, done) {
    var r = Request({
        url: ROOT + "echo/",
        content: "test",
        onComplete: (res) => {
            assert.equal(res.json.content, "tset");
            assert.equal(res.json.method, "PUT");
            assert.equal(res.json.headers.referer, "http://humanoids.be/");
            assert.equal(res.json.headers["x-something"], "adsf");
            mod.destroy();
            done();
        }
    });
    var mod = RequestMod({
        url: 'http://localhost*',
        direction: [ RequestMod.OUTGOING ],
        requestHandler: function(req) {
            assert.equal(req.url, r.url, "URL property works correctly");
            assert.equal(req.method, 'POST', "Method matches");
            assert.equal(req.direction, RequestMod.OUTGOING, "Direction is correct");
            assert.equal(req.referrer, null, "Referrer is matching");
            assert.throws(() => req.status, "Status is unavailable for outgoing requests");
            assert.equal(req.content, "test", "Content is read correctly");

            req.content = "tset";
            req.referrer = "http://humanoids.be/";
            req.method = 'PUT';
            let headers = req.headers;
            headers["x-something"] = "adsf";
            req.headers = headers;
        }
    });
    r.post();
};

exports['test incoming'] = function(assert, done) {
    var r = Request({
        url: ROOT,
        onComplete: (result) => {
            assert.equal(result.headers["X-Something"], "asdf");
            assert.equal(result.text, "foo");
            mod.destroy();
            done();
        }
    });
    var mod = RequestMod({
        url: 'http://localhost*',
        direction: [ RequestMod.INCOMING ],
        requestHandler: function(req) {
            assert.equal(req.url, r.url, "URL property matches the one of the request");
            assert.equal(req.method, 'GET', "Method matches");
            assert.equal(req.direction, RequestMod.INCOMING, "Direction is correct");
            assert.equal(req.referrer, null, "Referrer is matching");
            assert.equal(req.status, 200, "Status code is correct");
            //assert.equal(req.content, CONTENT); content is empty :(
            req.processContent(function(content) {
                assert.equal(content, CONTENT);
                return "foo";
            });

            assert.throws(() => { req.method = 'POST'; }, "The request method can only be set for outgoing requests");
            assert.throws(() => { req.referrer = 'http://humanoids.be'; }, "Cannot set the referrer of an incoming request");
            assert.throws(() => { req.url = 'http://humanoids.be'; }, "Cannot redirect an incoming request");
            req.headers = { "X-Something": "asdf" };
        }
    });
    r.get();
};

exports['test abort outgoing'] = function(assert, done) {
    var r = Request({
        url: ROOT,
        onComplete: function(response) {
            assert.equal(response.status, 0, "Request has been aborted");
            mod.destroy();
            done();
        }
    });
    var mod = RequestMod({
        url: 'http://localhost*',
        direction: [ RequestMod.OUTGOING ],
        requestHandler: function(req) {
            req.abort();
        }
    });
    r.get();
};

exports['test abort incoming'] = function(assert, done) {
    var r = Request({
        url: ROOT,
        onComplete: function(response) {
            assert.equal(response.status, 0, "Request has been aborted");
            mod.destroy();
            done();
        }
    });
    var mod = RequestMod({
        url: 'http://localhost*',
        direction: [ RequestMod.INCOMING ],
        requestHandler: function(req) {
            req.abort();
        }
    });
    r.get();
};

exports['test redirect'] = function(assert, done) {
    var r = Request({
        url: ROOT + "echo/",
        onComplete: function(res) {
            assert.equal(res.text, CONTENT, "Request successfully redirected");
            mod.destroy();
            done();
        }
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
};

//TODO test contracts

require("sdk/test").run(exports);
