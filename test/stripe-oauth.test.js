var apiRequest = require('./api-request')
var email = require('../email')
var http = require('http')
var parseJSON = require('json-parse-errback')
var runSeries = require('run-series')
var server = require('./server')
var simpleConcat = require('simple-concat')
var tape = require('tape')

var LICENSOR_EMAIL = 'licensor@example.com'
var LICENSOR_JURISDICTION = 'US-TX'
var LICENSOR_NAME = 'Test Licensor'

var SPONSOR_EMAIL = 'sponsor@example.com'
var SPONSOR_JURISDICTION = 'US-MD'
var SPONSOR_NAME = 'Larry Licensee'

var options = {
  skip: (
    !process.env.hasOwnProperty('STRIPE_SECRET_KEY') ||
    !process.env.hasOwnProperty('STRIPE_SHAREABLE_KEY') ||
    !process.env.hasOwnProperty('STRIPE_CLIENT_ID')
  )
}

tape('Stripe OAuth connect, register, license', options, function (suite) {
  server(8080, function (port, close) {
    withLicensor(port, suite, function (error, licensorID, token) {
      if (error) {
        suite.error(error)
        suite.end()
        return close()
      }

      var count = 0
      function closeServer () {
        if (++count === 2) close()
      }

      suite.test('license', function (test) {
        var projectID
        var paymentLocation
        var importPurchaseCommand
        runSeries([
          function offer (done) {
            apiRequest(port, {
              action: 'offer',
              licensorID: licensorID,
              token: token,
              homepage: 'http://example.com',
              pricing: {
                private: 500
              },
              description: 'a test project',
              terms: (
                'I agree to the agency terms at ' +
                'https://licensezero.com/terms/agency.'
              )
            }, function (error, response) {
              if (error) return done(error)
              test.equal(response.error, false, 'offer error false')
              test.assert(response.hasOwnProperty('projectID'), 'project id')
              projectID = response.projectID
              done()
            })
          },
          function order (done) {
            apiRequest(port, {
              action: 'order',
              projects: [projectID],
              licensee: 'Larry Licensee',
              jurisdiction: 'US-CA',
              email: 'licensee@example.com',
              person: 'I am a person, not a legal entity.'
            }, function (error, response) {
              if (error) return done(error)
              test.equal(response.error, false, 'order error false')
              test.assert(
                response.location.indexOf('/pay/') === 0,
                'location'
              )
              paymentLocation = response.location
              done()
            })
          },
          function pay (done) {
            var webdriver = require('./webdriver')
            webdriver
              .url('http://localhost:' + port + paymentLocation)
              .waitForExist('iframe')
              // Enter credit card.
              .element('iframe')
              .then(function (response) {
                return webdriver.frame(response.value)
              })
              .setValue('input[name="cardnumber"]', '4242 4242 4242 4242')
              .setValue('input[name="exp-date"]', '10 / 31')
              .setValue('input[name="cvc"]', '123')
              .waitForExist('input[name="postal"]')
              .setValue('input[name="postal"]', '12345')
              .frameParent()
              // Terms
              .scroll('input[name="terms"]')
              .click('input[name="terms"]')
              // Submit
              .scroll('input[type="submit"]')
              .click('input[type="submit"]')
              .waitForExist('h1.thanks', 30000)
              .getText('h1.thanks')
              .then(function (text) {
                test.equal(text, 'Thank You')
              })
              .getText('.import')
              .then(function (text) {
                importPurchaseCommand = text
                done()
              })
              .catch(done)
          },
          function fetchBundle (done) {
            var pathname = /\/purchases\/[0-9a-f-]+/
              .exec(importPurchaseCommand)[0]
            http.request({port: port, path: pathname})
              .once('error', done)
              .once('response', function (response) {
                simpleConcat(response, function (error, body) {
                  if (error) return done(error)
                  parseJSON(body, function (error, parsed) {
                    if (error) return done(error)
                    test.equal(
                      typeof parsed.date, 'string',
                      'date'
                    )
                    test.assert(
                      Array.isArray(parsed.licenses),
                      'array of licenses'
                    )
                    done()
                  })
                })
              })
              .end()
          }
        ], function (error) {
          test.error(error, 'no error')
          test.end()
          closeServer()
        })
      })

      suite.test('sponsor', function (test) {
        var projectID
        var paymentLocation
        var notificationMessage
        var agreementMessage
        var relicensePrice = 100000
        var formattedPrice = '$1000.00'
        var homepage = 'http://example.com/repo'
        var description = 'some project to relicense'
        runSeries([
          function offer (done) {
            apiRequest(port, {
              action: 'offer',
              licensorID: licensorID,
              token: token,
              homepage: homepage,
              pricing: {
                private: 500,
                relicense: relicensePrice
              },
              description: description,
              terms: (
                'I agree to the agency terms at ' +
                'https://licensezero.com/terms/agency.'
              )
            }, function (error, response) {
              if (error) return done(error)
              test.equal(response.error, false, 'offer error false')
              test.assert(response.hasOwnProperty('projectID'), 'project id')
              projectID = response.projectID
              done()
            })
          },
          function relicenseTheProject (done) {
            apiRequest(port, {
              action: 'sponsor',
              projectID: projectID,
              sponsor: SPONSOR_NAME,
              jurisdiction: SPONSOR_JURISDICTION,
              email: SPONSOR_EMAIL
            }, function (error, response) {
              if (error) return done(error)
              test.equal(response.error, false, 'relicense error false')
              test.assert(
                response.location.indexOf('/pay/') === 0,
                'location'
              )
              paymentLocation = response.location
              done()
            })
          },
          function pay (done) {
            var called = 0
            function twoPhaseDone () {
              if (++called === 2) done()
            }

            email.events.on('message', function (message) {
              if (message.subject === 'License Zero Relicense Agreement') {
                agreementMessage = message
              } else if (message.subject === 'License Zero Relicense') {
                notificationMessage = message
              }
              if (agreementMessage && notificationMessage) {
                email.events.removeAllListeners('message')
                twoPhaseDone()
              }
            })

            var webdriver = require('./webdriver')
            webdriver
              .url('http://localhost:' + port + paymentLocation)
              .waitForExist('iframe')
              // Enter credit card.
              .element('iframe')
              .then(function (response) {
                return webdriver.frame(response.value)
              })
              .catch(function (error) {
                test.error(error)
                done()
              })
              .setValue('input[name="cardnumber"]', '4242 4242 4242 4242')
              .setValue('input[name="exp-date"]', '10 / 31')
              .setValue('input[name="cvc"]', '123')
              .waitForExist('input[name="postal"]')
              .setValue('input[name="postal"]', '12345')
              .frameParent()
              .scroll('input[name="terms"]')
              .click('input[name="terms"]')
              .scroll('input[type="submit"]')
              .click('input[type="submit"]')
              .waitForExist('h1.thanks', 30000)
              .getText('h1.thanks')
              .then(function (text) {
                test.equal(text, 'Thank You')
                twoPhaseDone()
              })
              .catch(function (error) {
                test.error(error)
                done()
              })
          },
          function checkAgreementEmail (done) {
            var message = agreementMessage
            var text = agreementMessage.text.join('\n\n')
            test.assert(text.includes(formattedPrice), 'e-mail shows price')
            test.equal(message.to, SPONSOR_EMAIL, 'e-mail to sponsor')
            test.equal(message.cc, LICENSOR_EMAIL, 'e-mail cc licensor')
            test.assert(text.includes(projectID), 'e-mail project ID')
            test.assert(text.includes(homepage), 'e-mail homepage')
            test.assert(text.includes(description), 'e-mail description')
            done()
          },
          function checkAgreement (done) {
            var text = agreementMessage.agreement
            test.assert(text.includes('License Zero Relicense Agreement'), 'agreement title')
            test.assert(text.includes(projectID), 'agreement project ID')
            test.assert(text.includes(formattedPrice), 'agreement price')
            test.assert(text.includes(LICENSOR_NAME), 'agreement licensor name')
            test.assert(text.includes(LICENSOR_JURISDICTION), 'agreement licensor jurisdiction')
            test.assert(text.includes(SPONSOR_NAME), 'agreement sponsor name')
            test.assert(text.includes(SPONSOR_JURISDICTION), 'agreement sponsor jurisdiction')
            done()
          },
          function checkLicensorNotification (done) {
            var message = notificationMessage
            var text = notificationMessage.text.join('\n\n')
            test.assert(text.includes(formattedPrice), 'notification price')
            test.equal(message.to, LICENSOR_EMAIL, 'notification to licensor')
            test.assert(text.includes(projectID), 'notification project ID')
            test.assert(text.includes(homepage), 'notification homepage')
            test.assert(text.includes(description), 'notification description')
            done()
          }
        ], function (error) {
          test.error(error, 'no error')
          test.end()
          closeServer()
        })
      })
    })
  })
})

function withLicensor (port, test, callback) {
  var oauthLocation
  var licensorID
  var token
  runSeries([
    function register (done) {
      email.events.once('message', function (message) {
        message.text.forEach(function (line) {
          if (line.indexOf('https://connect.stripe.com') === 0) {
            oauthLocation = line
          }
        })
        done()
      })
      apiRequest(port, {
        action: 'register',
        email: LICENSOR_EMAIL,
        name: LICENSOR_NAME,
        jurisdiction: LICENSOR_JURISDICTION,
        terms: (
          'I agree to the terms of service at ' +
          'https://licensezero.com/terms/service.'
        )
      }, function (error, response) {
        if (error) {
          test.error(error)
        } else {
          test.equal(response.error, false, 'no error')
        }
      })
    },
    function authorize (done) {
      var webdriver = require('./webdriver')
      webdriver.url(oauthLocation)
        .waitForExist('=Skip this account form', 30000)
        .click('=Skip this account form')
        .getText('span.id')
        .then(function (text) {
          licensorID = text
        })
        .getText('code.token')
        .then(function (text) {
          token = text
        })
        .then(function () {
          done()
        })
        .catch(done)
    }
  ], function (error) {
    if (error) return callback(error)
    callback(null, licensorID, token)
  })
}
