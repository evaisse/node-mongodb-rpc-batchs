#!/usr/local/bin/node


const dotenv = require('dotenv').config({ silent: true});
const fs = require('fs');
const childProcess = require('child_process');
const stringio = require('@rauschma/stringio');
const stream = require('stream');
const Bottleneck = require("bottleneck");
const WebSocket = require('ws');
const workerName = require('human-readable-ids').hri.random();


const limiter = new Bottleneck({
    maxConcurrent: process.env.LIMITER_CONCURRENCY || 10,
    minTime: process.env.LIMITER_DELAY || 333,
});

const runTask = (msg, socket) => {
    console.log('schedule task', msg.task);
    return limiter.schedule(async () => {

        const task = msg.task;

        console.log('start task', task);

        const taskName = msg.task.taskName;
        const taskArguments = msg.task.taskArguments;


        if (!fs.existsSync('./' + taskName)) {
            console.warn("Invalid task", taskName, "from client ", from);
            return Promise.reject('invalid task '+taskName);
        }


        let stderr = new stream.Writable();

        stderr.on('data', (chunk) => {
            socket.send(JSON.stringify({ to: msg.from, type: "task:stderr", str: chunk }));
        });

        let stdout = new stream.Writable();

        stdout.on('data', (chunk) => {
            socket.send(JSON.stringify({ to: msg.from, type: "task:stdout", str: chunk }));
        });

        console.log('start running command', "./"+taskName, taskArguments);

        const child = childProcess.spawn("./"+taskName, taskArguments);

        child.stdout.on('data', (data) => {
            socket.send(JSON.stringify({ to: msg.from, type: "task:stdout", str: data+"" }));
        });

        child.stderr.on('data', (data) => {
            socket.send(JSON.stringify({ to: msg.from, type: "task:stderr", str: data+"" }));
        });

        try {
            let code = await stringio.onExit(child);
            console.log('done running command ', "./"+taskName, taskArguments);
            return Promise.resolve(code);
        } catch (e) {
            console.error(e);
            return Promise.reject(e);
        }

    });
};

const socket = new WebSocket(process.env.WS_URL);

// set interval before reconnection
socket.timeoutInterval = 5400;


socket.onopen = () => {

    console.log('Worker', workerName, 'connected');

    socket.send(JSON.stringify({
        type: "hello",
        name: `worker ${workerName} online`,
    }));

    socket.onmessage = (msg) => {
        msg = JSON.parse(msg.data);
        console.log('onmessage', msg);

        if (msg.type === "task:create") {

            socket.send(JSON.stringify({
                type: "task:handle",
                // notify everybody that you're handling the task
                to: msg.from,
                task: msg.task
            }));

            runTask(msg, socket).then((res) => {
                console.log("done task", msg);
                socket.send(JSON.stringify({
                    type: "task:exit",
                    result: res,
                    returnCode: 0
                }));
            }).catch((err) => {
                console.warn("error on task", msg, err);
                socket.send(JSON.stringify({
                    type: "task:exit",
                    result: err,
                    returnCode: 1,
                }));
            });

        }
        //
        // socket.emit('task:stdout:' + task.id, "gg");
        // socket.emit('task:stderr:' + task.id, "caca");
        //
        // socket.emit('task:complete:' + task.id, {
        //     returnCode: 0
        // });

    };
};

socket.onerror = (err) => {
    console.error(err);
};

socket.onclose = (close) => {
    console.log("close", close.code, close.reason);
};



