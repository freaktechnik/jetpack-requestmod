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

let srv = startServerAsync(-1);

require("sdk/test").run(exports);
