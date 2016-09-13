// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

var socketServer = require('net').createServer((c) => {
    console.error('client connected');

    c.on('end', () => {
        console.error('client disconnected');
    });

    c.on('data', (m) => {
        console.error(`client data: ${m}`);
        handleServerMessage(JSON.parse(m));
    });

    c.write(JSON.stringify({course:currentCourse}));
});
socketServer.listen(9100, () => {
    console.error('server bound');
});

