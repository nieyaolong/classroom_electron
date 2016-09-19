// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const server = require("http").createServer();
const io = require("socket.io")(server);

const port = 9101;

server.listen(port, () => {
    console.log(`Server listening at port ${port}`);
});

io.on('connection', (socket) => {

    socket.on('login', (data) => {
        socket.index = data.index;
        socket.name = data.name;
        socket.edu = data.edu;
        console.log(`student login: ${data}`);
    });

    socket.on('disconnect', () => {
        console.log(`student ${socket.index} logout.`);
    });

});

const startCourseButton = document.querySelector(".start-course");
const courseNameInput = document.querySelector(".course-name");

startCourseButton.onclick = () => {
    io.sockets.emit('start course', {course:courseNameInput.value});
};
