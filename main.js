import fs from 'fs'
import util from 'util'

import Docker from 'dockerode'
import ssh2 from 'ssh2'
import NodeRSA from 'node-rsa'

const docker = new Docker()

// Generate a temporary, throwaway private key.
const key = new NodeRSA({b: 2048})
const privKey = key.exportKey('pkcs1-private-pem')

new ssh2.Server({
  hostKeys: [ privKey ],
  banner: "Welcome!",
  ident: "ssh-to-docker",
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
        const stream = accept()
        stream.write('Let\'s look at some code!\n')

        docker.createContainer({
          Cmd: '/bin/bash',
          Image: 'ubuntu:latest',
          OpenStdin: true,
          Tty: true
        }, function (err, newContainer) {
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
                return
              }
              console.log("Container started!")
            })
          })
        })

        const onTimeout = function () {
          console.log('Closing session due to timeout')

          if (container) {
            container.remove({force: true}, function(err, data) {
              if (err) {
                console.log('Error removing container %s: %s', container.id, err)
              }
              console.log('Removed container')
            })
          }

          stream.close()
        }

        stream.on('data', function(chunk) {
          // Reset timeout
          if (stream.timeoutId) {
            clearTimeout(stream.timeoutId)
          }
          stream.timeoutId = setTimeout(onTimeout, 10000)
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

