// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

var setting = {
    user: 'Law',
    id: '1234567'
};

var classState = {
    PENDING: 0, PROCESSING: 1, DONE: 2
};

function updateMassage(state) {
    let message;
    switch (state) {
        case classState.PENDING:
            message = "尚未收到课程推送,请认真听讲";
            break;
        case classState.PROCESSING:
            message = "请戴上头盔开始课程";
            break;
        case classState.DONE:
            message = "课程结束,请认真听讲";
            break;
        default:
            message = state;
    }
    let p = document.querySelector(".message");
    p.innerHTML = message;
}

function start() {
    let name = document.querySelector(".user-name");
    name.innerHTML = setting.user;

    let id = document.querySelector(".user-id");
    id.innerHTML = setting.id;

    let pushButton = document.querySelector(".start-course");
    pushButton.onclick = pushCourse;

    updateMassage(classState.PENDING);
}

function pushCourse() {
    let courseInput = document.querySelector(".course-name");
    let courseName = courseInput.value;
    if (courseName == null || courseName.length == 0) {
        return;
    }

    updateMassage(classState.PROCESSING);
    let pushButton = document.querySelector(".start-course");
    pushButton.disabled = true;

    executeCourse(courseName);
    console.error(`pushing course: ${courseName}`);
}

function executeCourse(courseName) {
    const cp = require('child_process');
    const path = require('path');
    const child = cp.spawn('electron', [path.join(__dirname, '../course/course.js'), courseName]);

    child.on('exit', (m) => {
        console.error(`course ended: ${m}`);
        updateMassage(classState.DONE);
    })
}

var socketServer = require('net').createServer((c) => {
    console.error('client connected');

    c.on('end', () => {
        console.error('client disconnected');
    });

    c.on('data', (m) => {
        console.error(`client data: ${m}`);
    });

    c.write('connected');
});
socketServer.listen(9100, () => {
    console.error('server bound');
});

start();