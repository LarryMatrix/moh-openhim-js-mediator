#!/usr/bin/env node
'use strict'

const express = require('express')
const medUtils = require('openhim-mediator-utils')
const winston = require('winston')
const parser = require('body-parser')
const request = require('request')
const utils = require('./utils')

// Logging setup
winston.remove(winston.transports.Console)
winston.add(winston.transports.Console, {level: 'info', timestamp: true, colorize: true})

// Config
var config = {} // this will vary depending on whats set in openhim-core
const apiConf = process.env.NODE_ENV === 'test' ? require('../config/test') : require('../config/config')
const mediatorConfig = require('../config/mediator')

var port = process.env.NODE_ENV === 'test' ? 7001 : mediatorConfig.endpoints[0].port

/**
 * setupApp - configures the http server for this mediator
 *
 * @return {express.App}  the configured http server
 */
function setupApp () {
  const app = express()

  app.use(parser.json({
    limit: '10Mb',
    type: ['application/fhir+json', 'application/json+fhir', 'application/json']
  }))

  app.post('/post-sample', (req, res) => {
    winston.info(`Processing ${req.method} request on ${req.url}`)

    // add logic to alter the request here
    let username = mediatorConfig.config.username
    let password = mediatorConfig.config.password
    let url = mediatorConfig.config.url

    let options = {
      url: url,
      headers: {
        Authorization: `Basic ` + new Buffer(username + ':' + password).toString('base64')
      },
      body: JSON.stringify(req.body)
    }
    // res.send(options)
    request.post(options, (err, response, body) => {
      if (err) {
        res.status(400).send('Error')
      }

      // capture orchestration data
      var orchestrationResponse = {
        statusCode: response.statusCode,
        headers: response.headers
      }
      let orchestrations = []
      orchestrations.push(utils.buildOrchestration('Capturing Orchestration Data Route', new Date().getTime(), req.method, req.url, req.headers, JSON.stringify(req.body), orchestrationResponse, body))

      // set content type header so that OpenHIM knows how to handle the response
      res.set('Content-Type', 'application/json+openhim')

      // construct return object
      let properties = {
        property: 'Primary Route'
      }
      const statusMessage = response.statusCode === 200 ? 'Successful' : 'Completed'
      res.send(utils.buildReturnObject(mediatorConfig.urn, statusMessage, response.statusCode, response.headers, body, orchestrations, properties))
    })

  })

  app.get('/get-sample', (req, res) => {
    winston.info(`Processing ${req.method} request on ${req.url}`)

    // add logic to alter the request here
    let username = mediatorConfig.config.username
    let password = mediatorConfig.config.password
    let url = mediatorConfig.config.url

    let options = {
      url: url,
      headers: {
        Authorization: `Basic ` + new Buffer(username + ':' + password).toString('base64')
      },
      body: JSON.stringify(req.body)
    }
    // res.send(options)
    request.get(options, (err, response, body) => {
      if (err) {
        res.status(400).send('Error')
      }

      // capture orchestration data
      var orchestrationResponse = {
        statusCode: response.statusCode,
        headers: response.headers
      }
      let orchestrations = []
      orchestrations.push(utils.buildOrchestration('Capturing Orchestration Data Route', new Date().getTime(), req.method, req.url, req.headers, JSON.stringify(req.body), orchestrationResponse, body))

      // set content type header so that OpenHIM knows how to handle the response
      res.set('Content-Type', 'application/json+openhim')

      // construct return object
      let properties = {
        property: 'Primary Route'
      }
      const statusMessage = response.statusCode === 200 ? 'Successful' : 'Completed'
      res.send(utils.buildReturnObject(mediatorConfig.urn, statusMessage, response.statusCode, response.headers, body, orchestrations, properties))
    })

  })
  return app
}

/**
 * start - starts the mediator
 *
 * @param  {Function} callback a node style callback that is called once the
 * server is started
 */
function start (callback) {
  if (apiConf.api.trustSelfSigned) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' }

  if (apiConf.register) {
    medUtils.registerMediator(apiConf.api, mediatorConfig, (err) => {
      if (err) {
        winston.error('Failed to register this mediator, check your config')
        winston.error(err.stack)
        process.exit(1)
      }
      apiConf.api.urn = mediatorConfig.urn
      medUtils.fetchConfig(apiConf.api, (err, newConfig) => {
        winston.info('Received initial config:')
        winston.info(JSON.stringify(newConfig))
        config = newConfig
        if (err) {
          winston.error('Failed to fetch initial config')
          winston.error(err.stack)
          process.exit(1)
        } else {
          winston.info('Successfully registered mediator!')
          let app = setupApp()
          const server = app.listen(port, () => {
            if (apiConf.heartbeat) {
              let configEmitter = medUtils.activateHeartbeat(apiConf.api)
              configEmitter.on('config', (newConfig) => {
                winston.info('Received updated config:')
                winston.info(JSON.stringify(newConfig))
                // set new config for mediator
                config = newConfig

                // we can act on the new config received from the OpenHIM here
                winston.info(config)
              })
            }
            callback(server)
          })
        }
      })
    })
  } else {
    // default to config from mediator registration
    config = mediatorConfig.config
    let app = setupApp()
    const server = app.listen(port, () => callback(server))
  }
}
exports.start = start

if (!module.parent) {
  // if this script is run directly, start the server
  start(() => winston.info(`Listening on ${port}...`))
}
