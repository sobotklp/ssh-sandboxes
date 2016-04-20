import fs from 'fs'
import util from 'util'

import ssh2 from 'ssh2'
import NodeRSA from 'node-rsa'

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
//        console.log('Client wants a ptty: ' + util.inspect(info))
        accept()
      })
      session.once('shell', (accept, reject) => {
        console.log('Client wants a shell!')
        var stream = accept()
        stream.write('Let\'s look at some code!\n')
        stream.exit(0)
        stream.end()
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

