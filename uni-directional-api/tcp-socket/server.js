var net = require('net');

var server = net.createServer(function(socket) {
    socket.write('Echo server\r\n');
    // socket.pipe(socket);

    socket.on('data', function(data) {
        console.log(`received from client: ${data}`);
    });
});

server.listen(1337, '127.0.0.1');

