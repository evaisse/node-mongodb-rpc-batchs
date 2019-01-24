#!/usr/local/bin/node
const dotenv = require('dotenv').config({ silent: true});
const program = require('commander');
const package = require('./../package.json');
const WebSocket = require('ws');
const uniqid = require('uniqid');

process.env.TASK_TIMEOUT = Math.floor(process.env.TASK_TIMEOUT) || (60 * 60);
process.env.TASK_CONNECT_TIMEOUT = process.env.TASK_CONNECT_TIMEOUT || 5;

program
  .version(package.version)
  .usage('[options] <taskName> [taskArguments ...]')
  .option('-r, --recipients', 'a list of reciptients separated by commas')
  .option('-t, --timeout [sec]', 'task timeout (in seconds)', v => parseInt(v, 10), process.env.TASK_TIMEOUT)
  .option('-v, --verbose', 'Show verbose output')
  .parse(process.argv);


let taskName = program.args.pop();
let taskArguments = Array.from(program.args);

if (!taskName) {
    program.outputHelp();
    process.exit(1);
}

if (!taskName.match(/^[a-z][a-z0-9\-.]+[a-z0-9]$/i)) {
    console.error('invalid task');
    process.exit(1);
}

if (!program.timeout) {
    console.error('bad timeout (min 1 seconds)');
    process.exit(1);
}



const task = {
    taskName,
    taskArguments,
    taskId: uniqid()
};

const workers = new Set([]);
const socket = new WebSocket(process.env.WS_URL);


let timer = setTimeout(() => {
    console.error("Program timeouted after", program.timeout * 1000, "seconds");
    try {

        socket.send(JSON.stringify({
            to: Array.from(workers),
            type: "abort",
            id: task.id
        }), () => {
            socket.close();
            process.exit(1);
        });
    } catch (e) {
        console.error(e);
    }
    // ensure kill do not take more than 500 ms
    setTimeout(() => process.exit(1), 500);
}, program.timeout * 1000);

let returnCode = 0;


socket.onopen = () => {
    console.log('connected');
    socket.send(JSON.stringify({
        type: "task:create",
        task: task
    }));

    socket.onmessage = (msg) => {
        msg = JSON.parse(msg.data);
        // console.log(msg);

        if (msg.type === "task:handle" && msg.from) {
            console.log('worker', msg.from, 'handle task');
            workers.add(msg.from);
        }

        if (msg.type === "task:stderr") {
            process.stderr.write(msg.str);
        }

        if (msg.type === "task:stdout") {
            process.stdout.write(msg.str);
        }

        if (msg.type === "task:exit") {
            workers.delete(msg.from);
            if (msg.returnCode !== returnCode && msg.returnCode !== 0) {
                returnCode = msg.returnCode;
            }
            process.exit(returnCode);
        }
    };

    setTimeout(() => {

        if (!workers.size) {
            console.error("No workers available");
            process.exit(1);
        }

    }, process.env.TASK_CONNECT_TIMEOUT * 1000);

};



socket.onerror = (err) => {
    console.error(err);
};

socket.onclose = (close) => {
    console.log("close", close.code, close.reason);
};



//
// console.log('connect', process.env.IO_URL);
//
// const socket = require('socket.io-client')(process.env.IO_URI);
//
// socket.on('connect', function() {
//
//     console.log('connected', arguments);
//
//     socket.emit('test', 'fkfjlfjl');
//
//     socket.emit('task:create', task, (taskId) => {
//
//         console.log(taskId);
//
//         socket.on('task:'+taskId, (msg) => {
//             console.log(msg);
//             if (msg.returnCode !== undefined) {
//                 process.exit(msg.returnCode);
//             }
//         });
//
//
//         socket.on('disconnect', () => {
//             process.exit(1);
//         });
//     });
//
// });
//
// socket.on('event', function (data) {
//     console.log('event', arguments);
// });
//
// socket.on('disconnect', function () {
//     console.log('disconnect', arguments);
// });
//
//
// socket.on('error', function () {
//     console.log('error', arguments);
// });
