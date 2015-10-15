/**
 * Simple interface for request modification in Firefox. Use with care, as it
 * can slow down requests drastically, since the handler is ran sync and blocks
 * the request from getting sent/received. And you can in theory look at all the
 * user's traffic.
 *
 * It's generally advised to try an alternative method from
 * {@link https://developer.mozilla.org/en-US/Add-ons/Overlay_Extensions/XUL_School/Intercepting_Page_Loads|MDN: Intercept Page Loads}
 * instead. This implementation covers the "HTTP Observers" part.
 *
 * @author Martin Giger
 * @license MPL-2.0
 * @module requestmod
 * @borrows module:lib/const.INCOMING as INCOMING
 * @borrows module:lib/const.OUTGOING as OUTGOING
 */

"use strict";

const { Class } = require("sdk/core/heritage");
const { Disposable } = require("sdk/core/disposable");
const events = require("sdk/system/events");
const { Ci } = require("chrome");
const { OngoingRequest } = require("./ongoingrequest");
const { Rules } = require("sdk/util/rules");
const { contract } = require("sdk/util/contract");
const { isRegExp } = require("sdk/lang/type");
const { INCOMING, OUTGOING } = require("./const");

const INCOMING_OBSERVER = "http-on-examine-response";
const OUTGOING_OBSERVER = "http-on-modify-request";

const models = new WeakMap();

const modelFor = (rm) => models.get(rm);

// Modified contract from pagemod.
const isRegExpOrString = (v) => isRegExp(v) || typeof v === 'string';
const isDirection = (v) => v === INCOMING || v === OUTGOING;

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
        msg: 'The `url` option must always contain at least one rule as a string, regular expression, or an array of strings and regular expressions.'
    },
    direction: {
        is: ['array'],
        ok: (direction) => Array.isArray(direction) && direction.length > 0 && direction.every(isDirection),
        msg: 'The `direction` option must always be an array with at least one item and each item must have the value of a direction constant.'
    },
    requestHandler: {
        is: ['function'],
        msg: 'The `requestHandler` option must always be a function.'
    }
});

let RequestMod = Class(
/** @lends module:requestmod.RequestMod.prototype */
{
    implements: [
        Disposable,
        modContract.properties(modelFor)
    ],
    /**
     * Must execute actions on the {@link module:lib/ongoingrequest.OngoingRequest|OngoingRequest} object synchronously.
     * @callback requestCallback
     * @argument {module:lib/ongoingrequest.OngoingRequest} request
     */
    /**
     * The string can contain '*' wildcards.
     * @typedef MatchPattern
     * @type {(string|RegExp)}
     * @see {@link https://developer.mozilla.org/en-US/Add-ons/SDK/Low-Level_APIs/util_match-pattern|MDN: SDK match-pattern module}
     */
    /**
     * @typedef {Object} RequestModOptions
     * @property {Array.<module:lib/const~Direction>} direction - The request
     * directions that should be listened for
     * @property {(Array.<module:requestmod~MatchPattern>|module:requestmod~MatchPattern)} url - URL patterns
     * @property {module:requestmod~requestCallback} requestHandler
     */
    /**
     * @constructs
     * @extends external:sdk/core/disposable.Disposable
     * @argument {module:requestmod~RequestModOptions} options
     */
    setup: function(options) {
        let model = modContract(options);
        models.set(this, model);

        model.url = Rules();
        model.url.add(options.url);

        this.observe = this.observe.bind(this);
        if(model.direction.includes(INCOMING)) {
            events.on(INCOMING_OBSERVER, this.observe);
        }
        if(model.direction.includes(OUTGOING)) {
            events.on(OUTGOING_OBSERVER, this.observe);
        }
    },
    observe: function({type, subject, data}) {
        const direction = type === INCOMING_OBSERVER ? INCOMING : OUTGOING;
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
