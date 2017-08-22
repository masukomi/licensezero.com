var email = require('./email')
var pinoHTTP = require('pino-http')
var routes = require('./routes')
var url = require('url')

module.exports = function makeRequestHandler (service, log) {
  var pino = pinoHTTP({logger: log})
  service.email = email(service, log)
  return function requestHandler (request, response) {
    pino(request, response)
    var parsed = url.parse(request.url, true)
    request.query = parsed.query
    request.pathname = parsed.pathname
    var route = routes.get(parsed.pathname)
    if (route.handler) {
      request.params = route.params
      route.handler(request, response, service)
    } else {
      response.statusCode = 404
      response.end()
    }
  }
}
