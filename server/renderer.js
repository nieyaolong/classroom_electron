// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
"use strict";

const server = require("http").createServer();
const io = require("socket.io")(server);

const video = require("./video");

const port = 9101;

let sockets = new Map();

server.listen(port, () => {
    console.log(`Server listening at port ${port}`);
});


io.on('connection', (socket) => {

    socket.on('login', (data) => {
        socket.index = Number(data.index);
        socket.name = data.user;
        socket.edu = data.edu;
        seatInfo[data.index] = {user: data.user, edu: data.edu, status: seatStatus.CONNECTED};
        console.log(`student login: ${JSON.stringify(data)}`);
        updateStatus(socket.index);
        sockets.set(socket.index, socket);
        video.init(socket);
    });

    socket.on('course-pushed', () => {
        seatInfo[socket.index].status = seatStatus.PROCESSING;
        Object.keys(seatInfo).forEach(index => {
            seatInfo[index].answer = undefined;
        });
        updateStatus(socket.index);
    });

    socket.on('course-done', (data) => {
        let answer;
        if (data.answers instanceof Array && data.answers.length > 0) {
            answer = data.answers[0];
        } else {
            console.error('BUG:bad answer');
        }
        seatInfo[socket.index].status = seatStatus.DONE;
        seatInfo[socket.index].answer = answer;

        console.log(`student ${socket.name} submit answer: ${answer}`);
        updateStatus(socket.index);
        update_answer();
    });

    socket.on('course-exit', (data) => {
        //课程进程结束
        seatInfo[socket.index].status = data ? seatStatus.FAILED : seatStatus.CONNECTED;
        updateStatus(socket.index);
        updateThumbnail(socket.index, null);
        if (currentStreamIndex == socket.index) {
            updateVideo(null);
            currentStreamIndex = null;
        }
    });


    socket.on('disconnect', () => {
        console.log(`student ${socket.index} logout.`);
        seatInfo[socket.index] = {status: seatStatus.DISCONNECT};
        updateStatus(socket.index);
        sockets.delete(socket.index);
        updateThumbnail(socket.index, null);
        video.destroy(socket.index);
    });

    socket.on('reconnect', (data) => {
        console.log(`student reconnect: ${JSON.stringify(data)}`);
        console.error(data);
    })

});

let currentStreamIndex = null;

function getSocketByIndex(index) {
    for(let name in io.sockets.sockets) {
        if(io.sockets.sockets.hasOwnProperty(name)) {
            let s = io.sockets.sockets[name];
            if (s.index == index) {
                return s;
            }
        }
    }
    console.error(`Miss socket ${index}`);
    return null;
}

streamAction = (index) => {
    let socket = getSocketByIndex(index);
    if(socket) {
        video.requestStream(index, socket);
    }
};

showStudent = (index) => {
    console.log(`showing student ${index}`);
    let statusInfo = '';
    let studentInfo = seatInfo[index].status == seatStatus.DISCONNECT ? null : `姓名: ${seatInfo[index].user}\n学号:${seatInfo[index].edu}`;
    let answerInfo = (seatInfo[index].status == seatStatus.DONE && seatInfo[index].answer) ? `\n答题结果:${seatInfo[index].answer}` : null;
    switch (seatInfo[index].status) {
        case seatStatus.DISCONNECT:
            statusInfo = '未连接';
            break;
        case seatStatus.CONNECTED:
            statusInfo = '已连接';
            break;
        case seatStatus.PROCESSING:
            statusInfo = '正在进行课程';
            break;
        case seatStatus.DONE:
            statusInfo = '课程结束';
            break;
    }
    let message = `状态: ${statusInfo}\n`;
    if (studentInfo) {
        message += studentInfo;
        if (answerInfo) {
            message += answerInfo;
        }
    }
    alert(message);
};

const courseInfo = require("./courses.json");
pushCourse = (index) => {
    console.log(`pushing course ${index}`);
    let c = null;
    courseInfo.forEach(course => {
        if (course.id === index) {
            c = course;
        }
    });
    if (!c || !c.name) {
        alert('课程信息有误');
    } else {
        io.sockets.emit('start course', {course: c.name, index: c.index});
        alert(`开始课程 ${c.title}`);
    }
};


console.log('init_course');
init_courses(courseInfo, pushCourse);
