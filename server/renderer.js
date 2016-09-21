// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const server = require("http").createServer();
const io = require("socket.io")(server);

const port = 9101;

server.listen(port, () => {
    console.log(`Server listening at port ${port}`);
});

let answers = {};

io.on('connection', (socket) => {

    socket.on('login', (data) => {
        socket.index = data.index;
        socket.name = data.user;
        socket.edu = data.edu;
        console.log(`student login: ${JSON.stringify(data)}`);
    });

    socket.on('course-done', (data) => {
        if(data.answers instanceof Array && data.answers.length > 0) {
            answers[socket.index] = data.answers[0];
        } else {
            console.error('BUG:bad answer');
        }
        console.log(`student ${socket.name} submit answer: ${JSON.stringify(answers)}`)
    });

    socket.on('disconnect', () => {
        console.log(`student ${socket.index} logout.`);
    });

});

const startCourseButton = document.querySelector(".start-course");
const courseNameInput = document.querySelector(".course-name");

startCourseButton.onclick = () => {
    io.sockets.emit('start course', {course: courseNameInput.value});
};
