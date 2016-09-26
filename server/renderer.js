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
        socket.name = data.user;
        socket.edu = data.edu;
        seatInfo[data.index] = {user:data.user, edu:data.edu, status: seatStatus.CONNECTED};
        console.log(`student login: ${JSON.stringify(data)}`);
        updateStatus(socket.index)
    });

    socket.on('course-pushed', ()=> {
        seatInfo[socket.index].status = seatStatus.PROCESSING;
        Object.keys(seatInfo).forEach(index => {
            seatInfo[index].answer = undefined;
        });
        updateStatus(socket.index);
    });

    socket.on('course-done', (data) => {
        let answer;
        if(data.answers instanceof Array && data.answers.length > 0) {
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

    socket.on('disconnect', () => {
        console.log(`student ${socket.index} logout.`);
        seatInfo[socket.index] = {status:seatStatus.DISCONNECT};
        updateStatus(socket.index);
    });

});

pushCourse = (index) => {
    console.log(`pushing course ${index}`);
    io.sockets.emit('start course', {course: 'english', index:'001'});
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
    if(studentInfo) {
        message += studentInfo;
        if(answerInfo) {
            message += answerInfo;
        }
    }
    alert(message);
};

let courseInfo = [
    {id:'1', title:'英语 第三章 坠机', desc:'课后题目：Who was driving the plane before the crash?(A)', questions:[{question:'问题1',answer:'A'}]},
];

console.log('init_course');
init_courses(courseInfo, pushCourse);
