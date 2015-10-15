/**
 * OngoingRequest
 *
 * @author Martin Giger
 * @license MPL-2.0
 * @module lib/ongoingrequest
 */

"use strict";

const { Class } = require("sdk/core/heritage");
const { Disposable } = require("sdk/core/disposable");
const { Ci, Cr } = require("chrome");
const { newURI } = require("sdk/url/utils");
const { InputStream } = require("./inputstream");
const { contract } = require("sdk/util/contract");
const { NetUtil } = require("resource://gre/modules/NetUtil.jsm");
const { Headers } = require("./headers");
const { INCOMING, OUTGOING } = require("./const");
const { ChannelListener } = require("./channellistener");

/**
 * @const {Error} NS_ERROR_NOT_AVAILABLE
 */
const NS_ERROR_NOT_AVAILABLE = new Error("Operation could not be completed because some other necessary component or resource was not available.");

let channels = new WeakMap();
let models = new WeakMap();

let channelFor = (oreq) => channels.get(oreq);
let modelFor = (oreq) => models.get(oreq);

let isDirection = (v) => v === INCOMING || v === OUTGOING;

const requestContract = contract({
    channel: {
        is: ['object'],
        ok: (channel) => channel instanceof Ci.nsIHttpChannel,
        msg: 'The `channel` option must always implement nsIHttpChannel.'
    },
    direction: {
        is: ['number'],
        ok: (direction) => isDirection(direction),
        msg: 'The `direction` option must always be a single direction constant.'
    }
});

const OngoingRequest = Class(
/** @lends module:lib/ongoingrequest.OngoingRequest.prototype */
{
    extends: Disposable,
    /**
     * @typedef {Object} OngoingRequestOptions
     * @property {external:nsIHttpChannel} channel
     * @property {(module:requestmod.INCOMING|module:requestmod.OUTGOING)} direction
     */
    /**
     * Represents an incoming or outgoing request.
     * @constructs OngoingRequest
     * @extends external:sdk/core/disposable.Disposable
     * @argument {module:lib/ongoingrequest~OngoingRequestOptions} options - Specifies the channel, direction
     * @alias module:lib/ongoingrequest.OngoingRequest
     */
    setup: function(options) {
        requestContract(options);
        // In theory the contract already did this check
        options.channel.QueryInterface(Ci.nsIHttpChannel);

        channels.set(this, options.channel);
        models.set(this, { direction: options.direction, headers: Headers(options.channel, options.direction) });

        if(options.direction === INCOMING) {
            options.channel.QueryInterface(Ci.nsITraceableChannel);
            let model = modelFor(this);
            model.listener = ChannelListener();
            model.listener.oldListener = options.channel.setNewListener(model.listener);
        }
    },
    /**
     * The URL of the request. Setting this property factually redirects the
     * request to a different URL, opening a new request.
     * @type {string}
     * @throws {module:lib/ongoingrequest.NS_ERROR_NOT_AVAILABLE} When trying to set the URL of an
     * incoming request.
     */
    get url() {
        return channelFor(this).URI.spec;
    },
    set url(val) {
        if(this.direction === OUTGOING) {
            channelFor(this).redirectTo(newURI(val));
        }
        else {
            throw NS_ERROR_NOT_AVAILABLE;
        }
    },
    /**
     * Referer of the request.
     * @type {string}
     * @throws {module:lib/ongoingrequest.NS_ERROR_NOT_AVAILABLE} When trying to set the referer of an
     * incoming request.
     */
    get referrer() {
        return channelFor(this).referrer && channelFor(this).referrer.spec;
    },
    set referrer(val) {
        if(this.direction === OUTGOING) {
            channelFor(this).referrer = newURI(val);
        }
        else {
            throw NS_ERROR_NOT_AVAILABLE;
        }
    },
    /**
     * The request method.
     * @type {string}
     * @throws {module:lib/ongoingrequest.NS_ERROR_NOT_AVAILABLE} When trying to set the method of an
     * incoming request.
     */
    get method() {
        return channelFor(this).requestMethod;
    },
    set method(val) {
        if(this.direction === OUTGOING) {
            channelFor(this).requestMethod = val;
        }
        else {
            throw NS_ERROR_NOT_AVAILABLE;
        }
    },
    /**
     * The request status code
     * @type {number}
     * @throws {module:lib/ongoingrequest.NS_ERROR_NOT_AVAILABLE} For outgoing requests.
     * @readonly
     */
    get status() {
        if(this.direction === INCOMING) {
            return channelFor(this).responseStatus;
        }
        else {
            throw NS_ERROR_NOT_AVAILABLE;
        }
    },
    /**
     * Access and modify request headers.
     * @type {module:lib/headers.Headers}
     * @readonly
     */
    get headers() {
        return modelFor(this).headers;
    },
    /**
     * Read and set the content. The reading part is not reliable for incoming
     * requests, due to the content's streaming nature. Consider the
     * processContent callback as an alternative.
     *
     * The content can be set to an SDK buffer, TypedArrays, ArrayBuffers, any string, object or a
     * nsIInputStream directly.
     *
     * The returned value will always be parsed to a string by default. If the stream
     * is outgoing and the content type contains "json" it will be parsed to an object.
     * @type {(Object|string)?}
     * @throws {module:lib/ongoingrequest.NS_ERROR_NOT_AVAILABLE} Whenever the content of an incoming
     * request is not complete yet.
     */
    get content() {
        if(this.direction === OUTGOING) {
            let channel = channelFor(this);
            channel.QueryInterface(Ci.nsIUploadChannel);
            let stream = channel.uploadStream;

            if(stream === null) {
                return null;
            }
            else {
                if(stream.available() > 0) {
                    let options = {};
                    options.charset = this.charset;

                    let value = NetUtil.readInputStreamToString(stream, stream.available(), options);

                    if(this.type.includes("json")) {
                        value = JSON.parse(value);
                    }

                    return value;
                }
                else {
                    return null;
                }
            }
        }
        else {
            let { listener } = modelFor(this);
            if(!listener.called && !listener.done) {
                throw NS_ERROR_NOT_AVAILABLE;
            }
            else {
                return modelFor(this).listener.value;
            }
        }
    },
    set content(val) {
        if(this.direction === OUTGOING) {
            let channel = channelFor(this);
            let method = this.method;
            channel.QueryInterface(Ci.nsIUploadChannel);

            let { stream } = InputStream(val);

            // The MIME InputStream already contains all the info headers.
            if(val === null || stream instanceof Ci.nsIMIMEInputStream) {
                channel.setUploadStream(stream, "", -1);
            }
            else {
                channel.setUploadStream(stream, this.type, -1);
            }
            // Re-set method
            this.method = method;
        }
        else {
            modelFor(this).listener.value = val;
            modelFor(this).listener.called = true;
        }
    },
    /**
     * Content Type.
     * @type {string}
     * @default "text/plain"
     */
    get type() {
        var type;
        try {
            type = channelFor(this).contentType;
        }
        catch(e) {
            // Try to get the content type from the header then
            type = this.headers.get("Content-Type");

            if(type === undefined)
                type = "text/plain";
        }
        return type;
    },
    set type(val) {
        channelFor(this).contentType = val;
    },
    /**
     * @type {string}
     * @default "UTF-8"
     */
    get charset() {
        let charset;
        try {
            charset = channelFor(this).contentCharset;
        }
        catch(e) {
            charset = "UTF-8";
        }
        return charset;
    },
    set charset(val) {
        channelFor(this).contentCharset = val;
    },
    /**
     * Direction of the request.
     * @type {module:requestmod.INCOMING|module:requestmod.OUTGOING}
     * @readonly
     */
    get direction() {
        return modelFor(this).direction;
    },
    /**
     * Is true if the request is for sure not cached, else null.
     * (not false, as it's not sure that it is in fact coming from the cache).
     * @type {?boolean}
     * @throws {module:lib/ongoingrequest.NS_ERROR_NOT_AVAILABLE} For outgoing requests.
     */
    get notCached() {
        if(this.direction === INCOMING) {
            let channel = channelFor(this);
            return channel.isNoStoreResponse() && channel.isNoCacheResponse() || null;
        }
        else {
            throw NS_ERROR_NOT_AVAILABLE;
        }
    },
    /**
     * Abort the request immediately.
     */
    abort: function() {
        let channel = channelFor(this);
        channel.QueryInterface(Ci.nsIRequest);
        channel.cancel(Cr.NS_BINDING_ABORTED);
    },
    /**
     * @callback processContentCallback
     * @argument {(string|Object)?} content
     * @return {(string|Object)?} The new content.
     */
    /**
     * Allows to process the full content into new content, however the callback
     * is possibly executed asynchronously and the `OngoingRequest` object might
     * have been destroyed by then.
     * @argument {module:lib/ongoingrequest~processContentCallback}
     */
    processContent: function(callback) {
        if(this.direction === OUTGOING) {
            this.content = callback(this.content);
        }
        else {
            modelFor(this).listener.processor = callback;
        }
    },
    dispose: function() {
        modelFor(this).headers.destroy();
        models.delete(this);
        channels.delete(this);
    }
});

exports.OngoingRequest = OngoingRequest;

