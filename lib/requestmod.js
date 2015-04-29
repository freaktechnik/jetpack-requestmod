/*
 * RequestMod by Martin Giger
 *
 * Simple interface for request modification in Firefox. Use with care, as it
 * can slow down requests drastically, since the handler is ran sync and blocks
 * the request from getting sent/received.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const { Class } = require("sdk/core/heritage");
const { Disposable } = require("sdk/core/disposable");
const events = require("sdk/system/events");
const { Ci } = require("chrome");
const { OngoingRequest, INCOMING, OUTGOING } = require("./ongoingrequest");
const { Rules } = require("sdk/util/rules");
const { contract } = require("sdk/util/contract");
const { isRegExp } = require("sdk/lang/type");

const INCOMING_OBSERVER = "http-on-examine-response";
const OUTGOING_OBSERVER = "http-on-modify-request";

let models = new WeakMap();

let modelFor = (rm) => models.get(rm);

// Modified contract from pagemod.
let isRegExpOrString = (v) => isRegExp(v) || typeof v === 'string';
let isDirection = (v) => v === INCOMING || v === OUTGOING;

const modContract = contract({
    url: {
        is: ['string', 'array', 'regexp'],
        ok: (rule) => {
            if (isRegExpOrString(rule))
                return true;
            if (Array.isArray(rule) && rule.length > 0)
                return rule.every(isRegExpOrString);
            return false;
        },
        msg: 'The `url` option must always contain atleast one rule as a string, regular expression, or an array of strings and regular expressions.'
    },
    direction: {
        is: ['array'],
        ok: (direction) => Array.isArray(direction) && direction.length > 0 && direction.every(isDirection),
        msg: 'The `direction` option must always be an array with at least one item and each item must have the value of a direction constant.'
    },
    requestHandler: {
        is: ['function'],
        msg: 'The `requestHandler` option must alwys be a function.'
    }
});

let RequestMod = Class({
    extends: Disposable,
    implements: [
        modContract.properties(modelFor)
    ],
    setup: function(options) {
        let model = modContract(options)
        models.set(this, model);

        model.url = Rules();
        model.url.add(options.url);

        this.observe = this.observe.bind(this);
        if(model.direction.indexOf(INCOMING) != -1) {
            events.on(INCOMING_OBSERVER, this.observe);
        }
        if(model.direction.indexOf(OUTGOING) != -1) {
            events.on(OUTGOING_OBSERVER, this.observe);
        }
    },
    observe: function({type, subject, data}) {
        let direction = type === INCOMING_OBSERVER ? INCOMING : OUTGOING;
        let model = modelFor(this);

        // Make sure we've got an HttpChannel
        subject.QueryInterface(Ci.nsIHttpChannel);
        let uri = subject.URI.spec;
        // Check if the request passes the url mask
        if(model.url.matchesAny(uri)) {
            // create ongoing request
            let oreq = OngoingRequest({
                direction: direction,
                channel: subject
            });
            // send ongoing request to listener and execute it
            model.requestHandler(oreq);
            // delete ongoing request (the beauty of synchronous execution)
            oreq.destroy();
        }
    },
    dispose: function() {
        let model = modelFor(this);
        if(model.direction.indexOf(INCOMING) != -1) {
            events.off(INCOMING_OBSERVER, this.observe);
        }
        if(model.direction.indexOf(OUTGOING) != -1) {
            events.off(OUTGOING_OBSERVER, this.observe);
        }

        for(let i in model.url) {
            model.url.remove(model.url[i]);
        }

        models.delete(this);
    },
    set url(val) {
        let model = modelFor(this);
        for(let i in model.url) {
            model.url.remove(model.url[i]);
        }
        model.url.add(val);
    }
});

RequestMod.INCOMING = INCOMING;
RequestMod.OUTGOING = OUTGOING;

exports.RequestMod = RequestMod;
