/**
 * Global constants
 * @author Martin Giger
 * @license MPL-2.0
 * @module lib/const
 */

"use strict";

/**
 * Constant for incoming requests, as in a response from a server. You generally
 * want to avoid this direction, except for modifying incoming headers.
 * @constant {number}
 * @default 0
 */
exports.INCOMING = 0;

/**
 * Constant signifying an outgoing request, as in a request going to a server.
 * @constant {number}
 * @default
 */
exports.OUTGOING = 1;
