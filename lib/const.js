/**
 * Global constants
 * @author Martin Giger
 * @license MPL-2.0
 * @module lib/const
 */

"use strict";

/**
 * @typedef Direction
 * @type {number}
 * @see {@link module:lib/const.INCOMING} and {@link module:lib/const.OUTGOING}
 */

/**
 * Constant for incoming requests, as in a response from a server. You generally
 * want to avoid this direction, except for modifying incoming headers.
 * @constant {Direction}
 * @default 0
 * @see {@link module:requestmod.INCOMING}
 */
exports.INCOMING = 0;

/**
 * Constant signifying an outgoing request, as in a request going to a server.
 * @constant {Direction}
 * @default
 * @see {@link module:requestmod.OUTGOING}
 */
exports.OUTGOING = 1;
