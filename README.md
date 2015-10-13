# jetpack-requestmod
[![Build Status](https://travis-ci.org/freaktechnik/jetpack-requestmod.svg?branch=master)](https://travis-ci.org/freaktechnik/jetpack-requestmod)

Modify ongoing requests using the Firefox Add-on SDK

Use with care, as it can slow down requests drastically, since the handler is
ran sync and blocks the request from getting sent/received.

## Getting Started
Please first consider using [WebRequest.jsm](https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/WebRequest.jsm) instead of this module. I hope to eventually move this module to WebRequest.jsm too, if possible. This will also add the possibility for normal events that can't modify requests.

To install the module, run `npm install --save requestmod` in your
extension's root directory.

You can then use the module inside your extension in the following manner:
```js
var { RequestMod } = require("requestmod");
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
It's generally advised to try an alternative method from [MDN: Intercept Page Loads][intercept] instead.
This implementation covers the "HTTP Observers" part.

### RequestMod(options)
Constructs a new `RequestMod` instance.

#### Options
##### url
An url pattern string with `*` wildcards (see [MDN: SDK match-pattern module][match-pattern] for detailed
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
This object genereally throws error when impossible actions are atempted.

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
Headers object. See the `Headers` documentation.

##### content
Read and set the content. The reading part is not reliable for incoming
requests, due to the content's streaming nature.

##### notCached
Returns `true` if the request is for sure not cached, else `null` (not false,
as it's not sure that it is in fact coming from the cache). Not readable for
outgoing requests.

##### direction
Readonly value for the direction of the request, so it's either
[`RequestMod.INCOMING`](#requestmodincoming) or
[`RequestMod.OUTGOING`](#requestmodoutgoing).

#### Methods
##### abort()
Abort the request immediately.

##### processContent(callback)
Allows to process the full content into new content, however the callback is
possibly executed asynchronously and the `OngoingRequest` object might have been
[destroyed](#destroy) by then.
###### Arguments
__callback__: `function` executed as soon as the content is known. Should
return the new content (else the content gets set to `undefined`).

Default value: `null`

##### destroy()
Destroy the `OngoingRequest` object. You should never have to call that, as it
is destroyed after the [`requestHandler`](#requesthandler) is executed.
When the object is destroyed, most methods will not work.

### Headers
Headers is an object to access and modify headers of a request. It implements an
interface similar to the JS `Map` object. It also implements the iterable
protocol, so you can iterate over it with for...of loops. Each value when
iterating is an object with a property `header` storing the name of the header
and `value` containing the header's value.

#### Methods
##### has(headerName)
Check if a header is set.

###### Arguments
__headerName__: `string` of the case sensitive name of the header.

##### get(headerName)
Gets the value of the specified header. Returns `undefined` if the header is not
set.

###### Arguments
__headerName__: `string`  of the case sensitive name of the header.

##### set(headerName, value)
Sets the value of the specified header. Replaces the existing value or creates a
new header if a header with the given name doesn't exist yet.

###### Arguments
__headerName__: `string` of the case sensitive name of the header.

__value__: `string` of the value to set the header to.

##### delete(headerName)
Removes a header from the request.

###### Arguments
__headerName__: `string` of the case sensitive name of the header.

##### forEach(callback)
Iterates over every set header.

###### Arguments
__callback__: `function` that takes two arguments: the first one is the name of
the header, the second one is the value of the header.

[match-pattern]: https://developer.mozilla.org/en-US/Add-ons/SDK/Low-Level_APIs/util_match-pattern "SDK match-pattern module"
[intercept]: https://developer.mozilla.org/en-US/Add-ons/Overlay_Extensions/XUL_School/Intercepting_Page_Loads "Intercept Page Loads"
