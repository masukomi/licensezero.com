var LICENSOR = require('./licensor')
var OFFER = require('./offer')
var UUIDV4 = require('../data/uuidv4-pattern')
var apiRequest = require('./api-request')
var clone = require('../data/clone')
var server = require('./server')
var tape = require('tape')
var writeTestLicensor = require('./write-test-licensor')

tape('offer', function (test) {
  server(function (port, close) {
    writeTestLicensor(function (error) {
      test.error(error)
      apiRequest(port, Object.assign(clone(OFFER), {
        licensorID: LICENSOR.id,
        token: LICENSOR.token
      }), function (error, response) {
        test.error(error)
        test.equal(
          response.error, false,
          'error false'
        )
        test.assert(
          response.hasOwnProperty('projectID'),
          'projectID'
        )
        test.assert(
          new RegExp(UUIDV4).test(response.projectID),
          'UUIDv4'
        )
        test.end()
        close()
      })
    })
  })
})

tape('offer w/ relicense', function (test) {
  server(function (port, close) {
    writeTestLicensor(function (error) {
      test.error(error)
      var request = clone(OFFER)
      request.pricing.relicense = 10000
      apiRequest(port, Object.assign(request, {
        licensorID: LICENSOR.id,
        token: LICENSOR.token
      }), function (error, response) {
        test.error(error)
        test.equal(
          response.error, false,
          'error false'
        )
        test.assert(
          response.hasOwnProperty('projectID'),
          'projectID'
        )
        test.assert(
          new RegExp(UUIDV4).test(response.projectID),
          'UUIDv4'
        )
        test.end()
        close()
      })
    })
  })
})
