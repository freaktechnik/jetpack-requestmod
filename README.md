# jetpack-requestmod
[![Build Status](https://travis-ci.org/freaktechnik/jetpack-requestmod.svg?branch=master)](https://travis-ci.org/freaktechnik/jetpack-requestmod)

Modify ongoing requests using the Firefox Add-on SDK

Use with care, as it can slow down requests drastically, since the handler is
ran sync and blocks the request from getting sent/received.

## Getting Started
To install the module, run `npm install --save jetpack-requestmod` in your
extension's root directory.

You can then use the module inside your extension in the following manner:
```js
var { RequestMod } = require("jetpack-requestmod");
```

## RequestMod Module
The module exports three things: two direction constants and the `RequestMod`
constructor

### Constants
#### RequestMod.OUTGOING
Constant signifying an outgoing request, as in a request going to a server.

#### RequestMod.INCOMING
Constant for incoming requests, as in coming from a server. You generally want
to avoid this direction, except for modifying incoming headers.
It's generally advised to try an alternative method from [][intercept] instead.
This implementation covers the "HTTP Observers" part.

### RequestMod(options)
Constructs a new `RequestMod` instance.

#### Options
##### url
An url pattern string with `*` wildcards (see [][match-pattern] for detailed
documentation on the syntax) or a regular expression or an array of such
elements.

##### direction
An array containing the constants for the requests that should be listened for.
The constants are either [`RequestMod.INCOMING`](#requestmodincoming) or
[`RequestMod.OUTGOING`](#requestmodoutgoing)

##### requestHandler
A callback function that gets passed an `OngoingRequest` object. Must execute
actions on the `OngoingRequest` object synchronously.

### OngoingRequest
#### Properties
##### url
The URL of the request as a string. Can only be written for outgoing requests.
Setting this property factually redirects the request to a different URL,
opening a new request.

##### referrer
The referrer of the request as a string. Can only be written for outgoing
requests.

##### method
The request method as string. Can only be written for outgoing requests.

##### status
Readonly statuscode of an incoming request.

##### headers
Headers object. Headers are only changed if the headers property itself is
overwritten.

##### content
Read and set the content. The reading part is not reliable for incoming
requests, due to the content's streaming nature.

##### direction
Readonly value for the direction of the request, so it's either
[`RequestMod.INCOMING`](#requestmodincoming) or
[`RequestMod.OUTGOING`](#requestmodoutgoing).

#### Methods
##### abort()
Abort the request.

##### processContent(callback)
Allows to process the full content into new content, however the callback is
possibly executed asynchronously and the `OngoingRequest` boject might have been
destroyed by then.
###### Arguments
callback: `function` executed as soon as the content is known. Should return the
new content.

Default value: `null`

##### destroy()
Destroy the `OngoingRequest` object. You should never have to call that, as it
is destroyed after the [`requestHandler`](#requesthandler) is executed.


[match-pattern]: https://developer.mozilla.org/en-US/Add-ons/SDK/Low-Level_APIs/util_match-pattern "SDK match-pattern module"
[intercept]: https://developer.mozilla.org/en-US/Add-ons/Overlay_Extensions/XUL_School/Intercepting_Page_Loads "Intercept Page Loads"
