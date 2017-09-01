var footer = require('./partials/footer')
var head = require('./partials/head')
var nav = require('./partials/nav')
var header = require('./partials/header')
var html = require('./html')

// TODO: about page

module.exports = function (request, response, service) {
  response.setHeader('Content-Type', 'text/html; charset=UTf-8')
  response.end(html`
<!doctype html>
<html lang=EN>
${head('About')}
<body>
  ${nav()}
  ${header()}
  <main>
  </main>
  ${footer()}
</body>
</html>
  `)
}