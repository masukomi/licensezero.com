var escape = require('./escape')
var footer = require('./partials/footer')
var head = require('./partials/head')
var header = require('./partials/header')
var html = require('./html')
var internalError = require('./internal-error')
var linkStandards = require('./link-standards')
var nav = require('./partials/nav')
var reciprocalLicense = require('../forms/reciprocal-license')

var REPOSITORY = (
  'https://github.com/licensezero/licensezero-reciprocal-license'
)

module.exports = function (request, response, service) {
  reciprocalLicense({
    name: '{Licensor Name}',
    homepage: '{https://example.com/project}'
  }, function (error, document) {
    if (error) {
      service.log.error(error)
      return internalError(response, error)
    }
    response.setHeader('Content-Type', 'text/html')
    response.end(html`
<!doctype html>
<html>
  ${head('Reciprocal Public License')}
  <body>
    ${nav()}
    ${header()}
    <main>
      <h1>Reciprocal Public License</h1>
      <p>
        License Zero projects are publicly licensed
        on the terms of either the following reciprocal
        license, or an alternative
        <a href=/licenses/noncommercial>noncommercial public license</a>.
      </p>
      <p>
        To review changes to, and submit feedback about,
        the License Zero Reciprocal Public License, visit
        <a href=${REPOSITORY}>${REPOSITORY}</a>.
      </p>
      <pre class=license>${linkStandards(escape(document))}</pre>
    </main>
    ${footer()}
  </body>
</html>
    `)
  })
}
