/**
 * Global constants
 * @author Martin Giger
 * @license MPL-2.0
 * @module lib/const
 */

"use strict";

/**
 * Constant signifying an outgoing request, as in a request going to a server.
 * @constant {number}
 * @default 0
 */
exports.INCOMING = 0;

/**
 * Constant for incoming requests, as in coming from a server. You generally
 * want to avoid this direction, except for modifying incoming headers.
 * @constant {number}
 * @default
 */
exports.OUTGOING = 1;
