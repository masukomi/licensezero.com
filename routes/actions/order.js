var assert = require('assert')
var readProject = require('../../data/read-project')
var runParallel = require('run-parallel')
var writeOrder = require('../../data/write-order')

exports.properties = {
  licensee: require('./common/name'),
  jurisdiction: require('./common/jurisdiction'),
  email: require('./common/email'),
  person: require('./common/person'),
  projects: {
    type: 'array',
    minItems: 1,
    maxItems: 100,
    items: require('./common/project-id')
  }
}

exports.handler = function (log, body, end, fail, lock) {
  assert.equal(typeof body, 'object')
  assert.equal(typeof end, 'function')
  assert.equal(typeof fail, 'function')
  assert.equal(typeof lock, 'function')
  var projects = body.projects
  runParallel(
    projects.map(function (projectID, index) {
      return function (done) {
        readProject(projectID, function (error, project) {
          if (error) {
            if (error.userMessage) {
              error.userMessage += ': ' + projectID
            }
            return done(error)
          }
          projects[index] = project
          done()
        })
      }
    }),
    function (error) {
      if (error) {
        /* istanbul ignore else */
        if (error.userMessage) return fail(error.userMessage)
        log.error(error)
        return fail('internal error')
      }
      var retracted = projects.filter(function (project) {
        return project.retracted
      })
      if (retracted.length !== 0) {
        return fail(
          'retracted projects: ' +
          retracted.map(projectIDOf).join(', ')
        )
      }
      var relicensed = projects.filter(function (project) {
        return project.relicensed
      })
      if (relicensed.length !== 0) {
        return fail(
          'relicensed projects: ' +
          relicensed.map(projectIDOf).join(', ')
        )
      }
      var pricedProjects = projects.map(function (project) {
        project.price = project.pricing.private
        delete project.pricing
        return project
      })
      writeOrder({
        projects: pricedProjects,
        licensee: body.licensee,
        jurisdiction: body.jurisdiction,
        email: body.email
      }, function (error, orderID) {
        if (error) return fail('internal error')
        end({location: '/pay/' + orderID})
      })
    }
  )
}

function projectIDOf (argument) {
  return argument.projectID
}
