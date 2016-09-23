// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
const params = require('url').parse(window.location.href, true).query;
const cp = require('child_process');
const path = require('path');

const Config = require('electron-config');
const config = new Config();

console.log(`config loaded:${config.path}`);

if (!config.get('index')) {
    config.store = {
        index: 1,
        server: 'localhost',
        server_port: 9101,
        port: 9100,
        courses: {
            english: path.join(__dirname, '../course/course.js')
        }
    };
}

var classState = {
    PENDING: 0, CONNECTED: 1, PROCESSING: 2, DONE: 3
};


var setting = {
    user: params['user-name'],
    id: params['edu-id'],
    server: `http://${config.get('server')}:${config.get('server_port')}`,
    index: config.get('index'),
    port: config.get('port'),
    courses: config.get('courses')
};

const ioSocket = require('socket.io-client')(setting.server);

console.log(`current config: ${JSON.stringify(setting)}`);


ioSocket.on('connect', ()=> {
    console.log(`connected :${setting.server}`);
    ioSocket.emit('login', {index: 1, user: setting.user, edu: setting.id});
    updateMessage(classState.CONNECTED);
});

ioSocket.on('disconnect', () => {
    console.log('disconnect with server');
});

ioSocket.on('start course', pushCourse);

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

function pushCourse(courseInfo) {

    let courseName = courseInfo.course;
    let courseIndex = courseInfo.index;

    updateMessage(classState.PROCESSING, courseName + courseIndex);

    currentCourse = `${courseName}:${courseIndex}`;
    executeCourse(currentCourse);
    console.error(`pushed course: ${JSON.stringify(courseInfo)}`);
}

function executeCourse(courseName) {
    const child = cp.spawn('electron', [setting.courses.english]);
    // const child = cp.spawn('/Users/nieyaolong/Code/VI/classroom_electron/package/classroomCourse.app/Contents/MacOS/classroomCourse');

    ioSocket.emit('course-pushed');

    child.on('exit', (m) => {
        console.error(`course ended: ${m}`);
    })
}

var answers = [];

function handleServerMessage(message) {
    if (message.event) {
        //事件
        if (message.event === 'done') {
            updateMessage(classState.DONE, answers);
            ioSocket.emit('course-done', {answers: answers});
            answers = [];
        }
    } else if (message.answer) {
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

    c.write(JSON.stringify({course: currentCourse}));
});
socketServer.listen(setting.port, () => {
    console.error('server bound');
});
