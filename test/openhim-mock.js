'use strict'

const https = require('https')
const URL = require('url')
const winston = require('winston')
const fs = require('fs')

var options = {
  key: fs.readFileSync('./test/tls-certs/key.pem'),
  cert: fs.readFileSync('./test/tls-certs/cert.pem'),
  requestCert: true,
  rejectUnauthorized: false,
  secureProtocol: 'TLSv1_method'
}

const server = https.createServer(options, function (req, res) {
  let body = ''
  req.on('data', function (chunk) {
    body += chunk.toString()
  })
  req.on('end', function () {
    winston.info(`Received ${req.method} request to ${req.url}`)
    winston.info(`with body: ${body}`)
    let url = URL.parse(req.url)
    if (url.path === '/mediators') {
      res.writeHead(201)
      res.end(JSON.stringify({ response: 'Ok' }))
    } else if (url.path === '/authenticate/root@openhim.org') {
      res.writeHead(200)
      res.end(JSON.stringify({
        ts: new Date(),
        salt: '123'
      }))
    } else if (url.path.split('/')[3] === 'heartbeat') {
      res.writeHead(200)
      res.end(JSON.stringify({ response: 'Ok' }))
    } else {
      winston.info('Error: no path matched')
      res.writeHead(500)
      res.end()
    }
  })
})

function start (callback) {
  server.listen(8080, function () {
    winston.info('OpenHIM Server listening on 8080...')
    callback()
  })
}
exports.start = start

function stop (callback) {
  server.close(callback)
}
exports.stop = stop

if (!module.parent) {
  // if this script is run directly, start the server
  start(() => winston.info('OpenHIM Server listening on 8080...'))
}
