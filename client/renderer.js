// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
"use strict";

const ipcRenderer = require('electron').ipcRenderer;

const params = require('url').parse(window.location.href, true).query;
const cp = require('child_process');
const path = require('path');
const Config = require('electron-config');
const config = new Config();

console.log(`config loaded:${config.path}`);

const os = require('os');
function getIndexFromIPAddress() {
    let ipAddress = null;
    let loInfo = os.networkInterfaces();
    for(let prop in loInfo) {
        if (loInfo.hasOwnProperty(prop)) {
            loInfo[prop].forEach(lo => {
                if (lo.family == 'IPv4' && lo.internal == false) {
                    ipAddress = lo.address;
                }
            });
        }
    }
    let result = ipAddress ? Number(ipAddress.split('.')[3]) : 0;
    notic(`自动获取座位编号：${result ? result : '失败，请修改配置文件'}`);
    return result;
}

var classState = {
    PENDING: 0, CONNECTED: 1, PROCESSING: 2, DONE: 3, FAILED:4
};

if(!config.get('index')) {
    notic('请正确配置座位编号');
    ipcRenderer.send('logout');
} else if(!config.get('server')) {
    notic('请正确配置教师端ip地址');
    ipcRenderer.send('logout');
} else {
    ipcRenderer.send('login',{edu: params['edu_id'], name: params['user_name']});
}

var setting = {
    user: params['user_name'],
    id: params['edu_id'],
    server: `http://${config.get('server')}:${config.get('server_port')}`,
    index: config.get('index'),
    port: config.get('port'),
};


const ioSocket = require('socket.io-client')(setting.server);

console.log(`current config: ${JSON.stringify(setting)}`);


ioSocket.on('connect', ()=> {
    console.log(`connected :${setting.server}`);
    ioSocket.emit('login', {index: setting.index, user: setting.user, edu: setting.id});
    updateStatus(classState.CONNECTED);
});

ioSocket.on('disconnect', () => {
    console.log('disconnect with server');
});

ioSocket.on('start course', pushCourse);

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
    if(state == classState.PENDING) {
        //等待5秒钟链接
        setTimeout(() => {
            if(currentStatus == classState.PENDING) {
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

    let courseName = courseInfo.course;

    let result = false;
    if(currentCourse) {
        console.log('no reentrant');
    } else {
        currentCourse = courseInfo;
        result = executeCourse(courseName);
        console.log(`pushed course: ${JSON.stringify(courseInfo)}: ${result}`);
    }
    if(result) {
        updateStatus(classState.PROCESSING);
        ioSocket.emit('course-pushed');
    }else {
        ioSocket.emit('course-failed');
    }
}

//return if success;
function executeCourse(courseName) {
    let exe = config.get(`courses.${courseName}`);
    if(!exe || exe == '') {
        console.error('missing target exe.');
        updateStatus(classState.FAILED, '请正确配置课程文件位置');
        currentCourse = null;
        return false;
    }

    try {
        const child = cp.spawn(exe);

        child.on('exit', (m) => {
            console.log(`course ended: ${m}`);
            currentCourse = null;
        });
        child.on('error', (e) => {
            console.error(e);
            currentCourse = null;
            ioSocket.emit('course-failed');
            updateStatus(classState.FAILED, e.message);
        });
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }

}

var answers = [];

function handleServerMessage(message) {
    if (message.event) {
        //事件
        if (message.event === 'done') {
            updateStatus(classState.DONE, answers);
            ioSocket.emit('course-done', {answers: answers});
            answers = [];
        }
    } else if (message.answer) {
        //答题
        answers.push(message.answer);
    }
}


var socketServer = require('net').createServer((c) => {
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
