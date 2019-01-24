const dotenv = require('dotenv').config({ silent: true });
const http = require('http');
const uniqid = require('uniqid');
const port = process.env.PORT || 3264;
const WebSocket = require('ws');
const fs = require('fs');


const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(fs.readFileSync(__dirname + "/index.html"));
});

const wss = new WebSocket.Server({ server: server });

// Broadcast to all.
wss.broadcast = (data, excludeClients) => {
    excludeClients = Array.isArray(excludeClients) ? excludeClients : [excludeClients];
    console.log('broadcast msg', data, 'with exclude clients', excludeClients, Array.from(wss.clients).map(c => c.id));
    Array.from(wss.clients).filter(client => {
        return client.readyState === WebSocket.OPEN
            && !excludeClients.find(c => c && c === client.id);
    }).forEach((client) => {
        client.send(typeof data === "string" ? data : JSON.stringify(data));
    });
};

wss.to = function (clientId, data) {
    Array.from(wss.clients)
        .filter(client => client.readyState === WebSocket.OPEN)
        .find((c) => c.id === clientId).send(typeof data === "string" ? data : JSON.stringify(data));
};

wss.on('connection', (socket) => {

    socket.id = uniqid();
    console.log('a user connected');
    socket.on('message', (msg) => {

        try {
            msg = JSON.parse(msg);
            msg.from = socket.id;
            console.log('message: ', msg);

            if (msg.to) {
                (Array.isArray(msg.to) ? msg.to : [msg.to]).forEach((to) => {
                    wss.to(to, Object.assign({}, msg, {to: to}));
                });
            }
            else {
                wss.broadcast(msg, socket.id);
            }
        } catch (e) {
            console.error('onmessage', e, console.log(msg.data));
            socket.send(JSON.stringify({ type: "error", message: "Invalid message "}));
        }
    });

});
//
// io.on('connection', (socket) => {
//
//     console.log('a user connected');
//
//     socket.on('task:create', (task, done) => {
//         console.log('task:create', task);
//         task.id = uniqid();
//         io.sockets.emit('task:create', task);
//         io.on('task:'+task.id, (msg) => {
//             socket.emit('task:'+task.id, msg);
//             if (msg.returnCode !== undefined) {
//                 socket.disconnect();
//             }
//         });
//         done(task);
//     });
//
//     socket.on('task:handle', (task) => {
//
//     });
// });



server.on('clientError', (err, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});


server.listen(port);
console.log('start server on port', port);
