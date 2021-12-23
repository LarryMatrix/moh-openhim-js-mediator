'use strict'

const tap = require('tap')
const mediatorMock = require('../lib/index')
const openhimMock = require('./openhim-mock')

tap.test('Test server start', (t) => {
  openhimMock.start(() => {
    mediatorMock.start((mediatorServer) => {
      t.ok(mediatorServer)
      mediatorServer.close(() => {
        openhimMock.stop(() => {
          t.end()
        })
      })
    })
  })
})
