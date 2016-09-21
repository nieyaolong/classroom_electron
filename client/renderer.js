// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.


var classState = {
    PENDING: 0, CONNECTED:1, PROCESSING: 2, DONE: 3
};

var params = require('url').parse(window.location.href, true).query;

var setting = {
    user: params['user-name'],
    id: params['edu-id'],
    server: params['server-addr'],
    index: params['index']
};

const ioSocket = require('socket.io-client')(setting.server);

ioSocket.on('connect', ()=> {
    console.log(`connected :${setting.server}`);
    ioSocket.emit('login', {index:1, user:setting.user, edu:setting.id});
    updateMessage(classState.CONNECTED);
});

ioSocket.on('disconnect', () => {
    console.log('disconnect with server');
});

ioSocket.on('start course', (data) => {
    let course = data.course;
    pushCourse(course);
});

function updateMessage(state, data) {
    let message;
    switch (state) {
        case classState.PENDING:
            message = "无法连接服务器,请等待老师开始课程";
            break;
        case classState.CONNECTED:
            message = "已连接服务器,请等待老师开始课程";
            break;
        case classState.PROCESSING:
            message = `请戴上头盔开始课程 ${data}`;
            break;
        case classState.DONE:
            message = `课程结束, 答题结果: ${data}`;
            break;
        default:
            message = state;
    }
    let p = document.querySelector(".message");
    p.innerHTML = message;
}

//init
let nameText = document.querySelector(".user-name");
nameText.innerHTML = setting.user;

let idText = document.querySelector(".user-id");
idText.innerHTML = setting.id;

updateMessage(classState.PENDING);

let currentCourse = null;

function pushCourse(courseName) {

    updateMessage(classState.PROCESSING, courseName);

    currentCourse = courseName;
    executeCourse(courseName);
    console.error(`pushing course: ${courseName}`);
}

function executeCourse(courseName) {
    const cp = require('child_process');
    const path = require('path');
    const child = cp.spawn('electron', [path.join(__dirname, '../course/course.js'), courseName]);
    // const child = cp.spawn('/Users/nieyaolong/Code/VI/classroom_electron/package/classroomCourse.app/Contents/MacOS/classroomCourse');

    child.on('exit', (m) => {
        console.error(`course ended: ${m}`);
    })
}

var answers = [];

function handleServerMessage(message) {
    if(message.event) {
        //事件
        if(message.event === 'done') {
            updateMessage(classState.DONE, answers);
            ioSocket.emit('course-done', {answers: answers});
            answers = [];
        }
    } else if(message.answer) {
        //答题
        answers.push(message.answer);
    }
}


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
