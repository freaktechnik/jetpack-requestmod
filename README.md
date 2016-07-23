# requestmod
[![Build Status](https://travis-ci.org/freaktechnik/jetpack-requestmod.svg?branch=master)](https://travis-ci.org/freaktechnik/jetpack-requestmod) [![Dependency Status](https://dependencyci.com/github/freaktechnik/jetpack-requestmod/badge)](https://dependencyci.com/github/freaktechnik/jetpack-requestmod)

Modify ongoing requests using the Firefox Add-on SDK

Use with care, as it can slow down requests drastically, since the handler is
ran sync and blocks the request from getting sent/received.

It's generally advised to try an alternative method from [MDN: Intercept Page Loads][intercept] instead.
This implementation covers the "HTTP Observers" part.

## Getting Started
Please first consider using [WebRequest.jsm][webrequest] instead of this module. I hope to eventually move this module to WebRequest.jsm too, if possible. This will also add the possibility for normal events that can't modify requests.

To install the module, run `npm install --save requestmod` in your
extension's root directory.

You can then use the module inside your extension in the following manner:
```js
var { RequestMod } = require("requestmod");
```

## Documentation
There is inline documentation in the JSDoc style, or alternatively there is a
prebuilt documentation on [freaktechnik.github.io/jetpack-requestmod][docs].

[intercept]: https://developer.mozilla.org/en-US/Add-ons/Overlay_Extensions/XUL_School/Intercepting_Page_Loads "Intercept Page Loads"
[webrequest]: https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/WebRequest.jsm "WebRequest.jsm"
[docs]: https://freaktechnik.github.io/jetpack-requestmod "Documentation"
