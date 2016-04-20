import fs from 'fs'
import util from 'util'
import EventEmitter from 'events'

import Docker from 'dockerode'
import ssh2 from 'ssh2'
import NodeRSA from 'node-rsa'

const docker = new Docker()

// Generate a temporary, throwaway private key.
const key = new NodeRSA({b: 1024})
const privKey = key.exportKey('pkcs1-private-pem')

const TIMEOUT = 100000

new ssh2.Server({
  hostKeys: [ privKey ],
  banner: "Welcome!",
  ident: "ssh-sandboxes",
}, (client) => {
  console.log("Client connected!")
    
  client.on('authentication', (ctx) => {
    // Blindly accept all connections. Only one per IP address allowed, though.
    ctx.accept()        
  }).on('ready', () => {
    console.log('Client authenticated!')
    client.on('session', function(accept, reject) {
      console.log('Client wants new session')
      var session = accept()
      session.once('pty', (accept, reject, info) => {
        accept()
      })
      session.once('shell', (accept, reject) => {
        console.log('Client wants a shell!')
        let container = null

        // Accept the connection and get a bidirectional stream.
        const stream = accept()

        var cleanupStream = function() {
          if (stream.timeoutId) {
            clearTimeout(stream.timeoutId)
          }

          if (container) {
            container.remove({force: true}, function(err, data) {
              if (err) {
                console.log('Error removing container %s: %s', container.id, err)
              }
              console.log('Removed container')
            })
          }
        }

        docker.createContainer({
          Cmd: '/bin/bash',
          Image: 'ubuntu:latest',
          OpenStdin: true,
          Tty: true
        }, function (err, newContainer) {
          if (err) {
            console.log(err)
            closeStream()
            return
          }

          container = newContainer
          container.attach({
            stream: true, stdin: true, stdout: true, stderr: true
          }, function (err, ttyStream) {
            console.log("Attached to container " + newContainer.id)

            // Attach output streams to client stream.
            ttyStream.pipe(stream);

            // Attach client stream to stdin of container
            stream.pipe(ttyStream);

            // Start the container
            newContainer.start((err, data) => {
              if (err) {
                console.error('Unable to start container', err)
                closeStream()
                return
              }
              console.log("Container started!")
            })
          })
        })

        const onTimeout = function () {
          console.log('Closing session due to timeout')
          stream.close()
        }

        stream.on('data', function(chunk) {
          // Reset timeout
          if (stream.timeoutId) {
            clearTimeout(stream.timeoutId)
          }
          stream.timeoutId = setTimeout(onTimeout, TIMEOUT)
        })

        stream.on('end', () => {
          console.log('Stream disconnected!')
          cleanupStream()
        })
      })
    })
  }).on('abort', () => {
    console.log('Client aborted!')
  }).on('end', () => {
    console.log('Client disconnected!')
  })

}).listen(0, '0.0.0.0', function() {
  console.log('Listening on port ' + this.address().port)
})

