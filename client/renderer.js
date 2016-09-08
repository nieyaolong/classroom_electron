// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

var setting = {
    user: 'Law',
    id: '1234567'
};

var classState = {
    PENDING:0, PROCESSING:1, DONE:2
};

function getMessage(state) {
    switch (state) {
        case classState.PENDING:
            return "尚未收到课程推送,请认真听讲";
        case classState.PROCESSING:
            return "请戴上头盔开始课程";
        case classState.DONE:
            return "课程结束,请认真听讲";
    }
}

function start(){
    let name = document.querySelector(".user-name");
    name.innerHTML = setting.user;

    let id = document.querySelector(".user-id");
    id.innerHTML = setting.id;

    let message = document.querySelector(".message");

    let state = classState.PENDING;
    message.innerHTML = getMessage(state);
}


start();