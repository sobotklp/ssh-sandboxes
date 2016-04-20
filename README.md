ssh-sandboxes
==================
A SSH server written in Nodejs that opens a shell to a new, isolated docker container for each connection.

Motivation
----------
This tool provides a way to create a containerized sandbox environment for every user that attempts to connect via ssh.


How to use
----------

To get set up as quickly as possible:

    var privKey = fs.readFileSync('/path/to/id_rsa');

    # Start ssh server on a random port without authentication. 
    new sshSandboxes({
      hostKeys: [ privKey ]
      image: 'ubuntu:latest',
      cmd: '/bin/bash'
    }).listen(0, '127.0.0.1', function () {
      console.log('Listening on port ' + this.address().port);
    });


Some additional parameters:

    new sshSandboxes({
      hostKeys: [ privKey ],
      image: 'ubuntu:latest',
      cmd: '/bin/bash',
      inactiveTimeout: 300,  // Time out after 300 seconds of inactivity
      sessionTimeout: 1200,  // Maximum session time in seconds
      
    }).listen(0, '0.0.0.0', function () {
      console.log('Listening on port ' + this.address().port);
    });
More detail to come here...
