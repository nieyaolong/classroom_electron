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
        updateStatus(socket.index, socket.name, true, '已登录')
    });

    socket.on('course-pushed', ()=> {
        updateStatus(socket.index, socket.name, true, '课程进行中');
    });

    socket.on('course-done', (data) => {
        let answer;
        if(data.answers instanceof Array && data.answers.length > 0) {
            answer = answers[socket.index] = data.answers[0];
        } else {
            console.error('BUG:bad answer');
        }
        console.log(`student ${socket.name} submit answer: ${JSON.stringify(answers)}`);
        updateStatus(socket.index, socket.name, true, answer ? `答题:${answer}`: '已完成课程')
    });

    socket.on('disconnect', () => {
        console.log(`student ${socket.index} logout.`);
        updateStatus(socket.index, socket.index, false, '未连接')
    });

});

const Course001Div = document.getElementById('course_001');
const Course002Div = document.getElementById('course_002');

Course001Div.onclick = () => {
    io.sockets.emit('start course', {course: 'english', index:'001'});
};
Course002Div.onclick = () => {
    io.sockets.emit('start course', {course: 'biology', index:'skin'});
};
