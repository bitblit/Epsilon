# Epsilon
A tiny library to simplify serving consistent apis from Lambda with OpenAPI

## How better than just using straight Node?
* Uses typescript instead of the Godforsaken straight javascript
* Handles route mapping (multiple ends, single lambda)
* Uses Promises and has a top level .catch to convert to 500
* Adds compression
* Adds CORS
* Adds JWT handling
* Consistent error handling
* Can serve static content as well
* Kinda-persistent objects allow for optimistic caching

# How better than using Express?
* Doesn't have req/res architecture to fake so much easier to test
* Much lighter


# Other service
* Environmental service
* Simple redirects
