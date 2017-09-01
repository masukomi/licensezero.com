var http = require('http')
var server = require('./server')
var simpleConcat = require('simple-concat')
var tape = require('tape')

testForm('waiver')
testForm('public-license')
testForm('private-licenses')

function testForm (form) {
  tape('GET /forms/' + form, function (test) {
    server(function (port, configuration, close) {
      http.request({port: port, path: '/forms/' + form})
        .once('error', function (error) {
          test.error(error, 'no error')
          finish()
        })
        .once('response', function (response) {
          test.equal(response.statusCode, 200, '200')
          simpleConcat(response, function (error, body) {
            test.error(error, 'no body error')
            test.assert(
              body.toString().includes('<pre class=license>'),
              'has <pre class=license>'
            )
            finish()
          })
        })
        .end()
      function finish () {
        test.end()
        close()
      }
    })
  })
}