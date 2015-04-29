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

const CONTENT = "<h1>Test</h1>";
let srv = startServerAsync(-1);
srv.registerPathHandler("/", function(request, response) {
    response.processAsync();
    response.setHeader('Content-Type', 'text/html', false);
    response.write(CONTENT);
    response.finish();
});

const PORT = srv.identity.primaryPort;
const ROOT = 'http://localhost:'+PORT+'/';

function compareHeaders(headers, expected) {
    return Object.keys(headers).every(function(h) {
        return headers[h] == expected[h];
    });
}

exports['test outgoing'] = function(assert, done) {
    var r = Request({
        url: ROOT,
        onComplete: () => {
            mod.destroy();
            done();
        }
    });
    var mod = RequestMod({
        url: 'http://localhost*',
        direction: [ RequestMod.OUTGOING ],
        requestHandler: function(req) {
            assert.equal(req.url, r.url, "URL property works correctly");
            assert.equal(req.method, 'GET', "Method matches");
            assert.equal(req.direction, RequestMod.OUTGOING, "Direction is correct");
            assert.equal(req.referrer, null, "Referrer is matching");
            assert.throws(() => req.status, "Status is unavailable for outgoing requests");

            //TODO test modifying stuff -> needs httpd to return the changed stuff
        }
    });
    r.get();
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

            assert.throws(() => { req.method = 'POST'; }, "The request method can only be set for outgoing requests");
            assert.throws(() => { req.referrer = 'http://humanoids.be'; }, "Cannot set the referrer of an incoming request");
            assert.throws(() => { req.url = 'http://humanoids.be'; }, "Cannot redirect an incoming request");
            req.headers = { "X-Something": "asdf" };
            req.content = "foo";
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

require("sdk/test").run(exports);
