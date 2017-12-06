#! /usr/bin/env node
'use strict'

const Upring = require('upring')
const fs = require('fs')
const path = require('path')
const http = require('http')
const querystring = require('querystring')
const Transform = require('readable-stream').Transform
const pino = require('pino-http')
const pump = require('pump')
const urlFormatLax = require('url-format-lax')
const args = require('minimist')(process.argv.slice(2), {
  boolean: ['help', 'verbose'],
  default: {
    port: 0,
    points: 100,
    timeout: 1000,
    verbose: false
  },
  alias: {
    port: 'p',
    points: 'P',
    help: 'h',
    timeout: 't',
    verbose: 'V'
  }
})

if (args.help) {
  console.log(fs.readFileSync(path.join(__dirname, 'help.txt'), 'utf8'))
  process.exit(1)
}

if (args.version) {
  console.log('upring-kv', 'v' + require('./package').version)
  process.exit(1)
}

const upring = Upring({
  base: args._,
  logLevel: args.verbose ? 'debug' : 'info',
  hashring: {
    replicaPoints: args.points,
    joinTimeout: args.timeout
  }
})

upring.use(require('upring-kv'))

upring.on('up', function () {
  console.log('to start a new peer, copy and paste the following in a new terminal:')
  console.log('node example', this.whoami())

  const logger = pino(upring.log)

  const server = http.createServer(function (req, res) {
    logger(req, res)
    switch (req.method) {
      case 'PUT':
      case 'POST':
        handlePost(req, res)
        break
      case 'GET':
        handleGet(req, res)
        break
      default:
        res.statusCode = 404
        res.end()
    }
  })

  server.listen(args.port, function (err) {
    if (err) {
      throw err
    }

    const address = server.address()

    if (address.address === '::') {
      address.host = '::1'
    } else {
      address.host = address.address
    }

    const url = 'http://' + urlFormatLax(address)

    // expose the address
    upring.info.url = url

    console.log('server listening on', url)
  })

  function handleGet (req, res) {
    const split = req.url.split('?')
    const key = split[0]
    const query = querystring.parse(split[1])
    if (query.live) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      })
      var transform = new Transform({
        objectMode: true,
        transform (chunk, enc, cb) {
          this.push('data:' + JSON.stringify(chunk.value) + '\n\n')
          cb()
        }
      })
      pump(upring.kv.liveUpdates(key), transform, res)
    } else {
      upring.kv.get(key, function (err, data) {
        if (err) {
          res.statusCode = 500
          res.end(err.message)
          return
        }

        if (!data) {
          res.statusCode = 404
          res.end()
          return
        }

        res.setHeader('Content-Type', data.contentType)
        res.end(data.value)
      })
    }
  }

  function handlePost (req, res) {
    var str = ''

    req.on('data', function (chunk) {
      str += chunk.toString()
    })

    req.on('error', function (err) {
      res.statusCode = 500
      res.end(err.message)
    })

    req.on('end', function () {
      var contentType = req.headers['content-type']
      if (!contentType || contentType === 'application/x-www-form-urlencoded') {
        contentType = 'text/plain'
      }
      upring.kv.put(req.url, {
        contentType,
        value: str
      }, function (err) {
        if (err) {
          res.statusCode = 500
          res.end(err.message)
        } else {
          res.statusCode = 200
          res.end()
        }
      })
    })
  }
})
