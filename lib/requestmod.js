/*
 * RequestMod by Martin Giger
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
const { OngoingRequest } = require("./ongoingrequest");
const { Rules } = require("sdk/utils/rules");

const INCOMING_OBSERVER = "http-on-examine-response";
const OUTGOING_OBSERVER = "http-on-modify-request";

const INCOMING = 0;
const OUTGOING = 1;

let models = new WeakMap();

let modelFor = (rm) => models.get(rm);

//TODO verify constructor options

let RequestMod = Class({
    extends: Disposable,
    setup: function(options) {
        models.set(this, options);

        let model = modelFor(this);
        model.url = Rules();
        rules.add(options.url);

        this.observe = this.observer.bind(this);
        if(options.direction.indexOf(INCOMING) != -1) {
            events.on(INCOMING_OBSERVER, this.observe);
        }
        if(options.direction.indexOf(OUTGOING) != -1) {
            events.on(OUTGOING_OBSERVER, this.observe);
        }
    },
    observe: function(subject, topic, data) {
        let direction = topic === INCOMING_OBSERVER ? INCOMING : OUTGOING;
        let model = modelFor(this);

        // Make sure we've got an HttpChannel
        subject.QueryInterface(Ci.nsIHttpChannel);
        let uri = subject.URI.spec;
        // Check if the request passes the url mask
        if(model.url.matchesAny(uri)) {
            // create ongoing request
            let oreq = OngoingRequest({
                direction: direction,
                stream: subject
            });
            // send ongoing request to listener and execute it
            model.requestHandler(oreq);
            // delete ongoing request (the beauty of synchronous execution)
            oreq.destroy();
        }
    },
    dispose: function() {
        if(modelFor(this).direction.indexOf(INCOMING) != -1) {
            events.off(INCOMING_OBSERVER, this.observe);
        }
        if(modelFor(this).direction.indexOf(OUTGOING) != -1) {
            events.off(OUTGOING_OBSERVER, this.observe);
        }

        for(let i in model.url) {
            model.url.remove(model.url[i]);
        }

        models.delete(this);
    },
    get direction() {
        return modelFor(this).direction;
    },
    get url() {
        return modelFor(this).url;
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
