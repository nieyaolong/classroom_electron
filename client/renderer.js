"use strict";

let video = require('./video.js');

const ipcRenderer = require('electron').ipcRenderer;

const params = require('url').parse(window.location.href, true).query;
const cp = require('child_process');
const path = require('path');
const Config = require('electron-config');
const config = new Config();

console.log(`config loaded:${config.path}`);

const os = require('os');
// function getIndexFromIPAddress() {
//     let ipAddress = null;
//     let loInfo = os.networkInterfaces();
//     for(let prop in loInfo) {
//         if (loInfo.hasOwnProperty(prop)) {
//             loInfo[prop].forEach(lo => {
//                 if (lo.family == 'IPv4' && lo.internal == false) {
//                     ipAddress = lo.address;
//                 }
//             });
//         }
//     }
//     let result = ipAddress ? Number(ipAddress.split('.')[3]) : 0;
//     notic(`自动获取座位编号：${result ? result : '失败，请修改配置文件'}`);
//     return result;
// }

let classState = {
    PENDING: 0, CONNECTED: 1, PROCESSING: 2, DONE: 3, FAILED: 4
};

if (!config.get('index')) {
    notic('请正确配置座位编号');
    ipcRenderer.send('logout');
} else if (!config.get('server')) {
    notic('请正确配置教师端ip地址');
    ipcRenderer.send('logout');
} else {
    ipcRenderer.send('login', {edu: params['edu_id'], name: params['user_name']});
}

let setting = {
    user: params['user_name'],
    id: params['edu_id'],
    server: `http://${config.get('server')}:${config.get('server_port')}`,
    index: config.get('index'),
    port: config.get('port'),
};


const ioSocket = require('socket.io-client')(setting.server);

console.log(`current config: ${JSON.stringify(setting)}`);


ioSocket.on('connect', () => {
    console.log(`connected :${setting.server}`);
    ioSocket.emit('login', {index: setting.index, user: setting.user, edu: setting.id});
    updateStatus(classState.CONNECTED);
});

ioSocket.on('disconnect', () => {
    console.log('disconnect with server');
});

ioSocket.on('course-start', pushCourse);

ioSocket.on('course-stop', killChild);

let currentStatus = classState.PENDING;

function updateStatus(state, data) {
    currentStatus = state;
    let message;
    switch (state) {
        case classState.PENDING:
            message = "无法连接服务器,请等待老师开始课程";
            break;
        case classState.CONNECTED:
            message = "已连接服务器,请等待老师开始课程";
            break;
        case classState.PROCESSING:
            message = `请戴上头盔开始课程`;
            break;
        case classState.DONE:
            message = `课程结束, 答题结果: ${data}`;
            break;
        case classState.FAILED:
            message = `出错: ${data}`;
            break;
        default:
            message = `未知状态:state`;
    }
    if (state == classState.PENDING) {
        //等待5秒钟链接
        setTimeout(() => {
            if (currentStatus == classState.PENDING) {
                notic(message);
            }
        }, 5000);
    } else {
        notic(message);
    }
}

function notic(message) {
    new Notification(message, {icon: 'img/classroom.ico'})
}

updateStatus(classState.PENDING);

let currentCourse = null;

function pushCourse(courseInfo) {

    let course = courseInfo.course;
    let thumbnailSize = courseInfo.thumbnail;
    let videoSize = courseInfo.video;

    let result = false;
    if (currentCourse) {
        console.log('no reentrant');
    } else {
        if (!thumbnailSize) {
            console.error('BUG: miss thumbnailSize');
            thumbnailSize = {width: 80, height: 60};
        }
        if (!videoSize) {
            console.error('BUG: miss videoSize');
            video = {width: 800, height: 600};
        }
        currentCourse = course;
        result = executeCourse(course, thumbnailSize, videoSize);
        console.log(`pushed course: ${JSON.stringify(courseInfo)}: ${result}`);
    }
    if (result) {
        updateStatus(classState.PROCESSING);
        ioSocket.emit('course-pushed');
    } else {
        ioSocket.emit('course-failed');
    }
}

let child;

function killChild(event, data) {
    if (child) {
        //关闭child监听
        child.removeAllListeners();
        ioSocket.emit('course-done');
        child.kill();
        updateStatus(classState.DONE, answers);
        answers = [];
        child = null;
    }
}

//return if success;
function executeCourse(course, thumbnailSize, videoSize) {
    try {
        let courseConfig = require(path.resolve(config.get(`courses.${course.root}`, 'course.json')));
        let courseInfo = courseConfig[course.name];

        if (!courseInfo.exe || courseInfo.exe == '') {
            console.error('missing target exe.');
            updateStatus(classState.FAILED, '请正确配置课程文件位置');
            currentCourse = null;
            return false;
        }

        child = cp.spawn(courseInfo.exe, courseInfo.parameters);
        // const path = require('path');
        // child = cp.spawn('electron', [path.join(__dirname, '../course/course.js'), courseName]);
        child.on('exit', (m) => {
            console.log(`course ended: ${m}`);
            ioSocket.emit('course-exit', m);
            currentCourse = null;
            video.stop(ioSocket);
            child = null;
        });
        child.on('error', (e) => {
            console.error(e);
            currentCourse = null;
            video.stop(ioSocket);
            ioSocket.emit('course-exit', -1);
            updateStatus(classState.FAILED, e.message);
            child = null;
        });

        //todo name
        video.start(ioSocket, course.title, thumbnailSize, videoSize);

        ipcRenderer.once('course-done', killChild);
    } catch (error) {
        console.error(error);
        updateStatus(classState.FAILED, '课程文件执行失败,请重新配置');
        currentCourse = null;
        return false;
    }


    return true;
}

let answers = [];

function handleServerMessage(message) {
    if (message.event) {
        //事件
        // if (message.event === 'done') {
        //     updateStatus(classState.DONE, answers);
        //     ioSocket.emit('course-done', {answers: answers});
        //     answers = [];
        // }
    } else if (message.answer) {
        //答题
        answers.push(message.answer);
    }
}


let socketServer = require('net').createServer((c) => {
    console.log('client connected');

    c.on('end', () => {
        console.log('client disconnected');
    });

    c.on('data', (m) => {
        console.log(`client data: ${m}`);
        handleServerMessage(JSON.parse(m));
    });

    c.write(JSON.stringify({course: currentCourse}));
});
socketServer.listen(setting.port, () => {
    console.log('server bound');
});
