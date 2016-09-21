// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

var setting = {
    index:null,

};

var courseState = {
    PENDING:0, PROCESSING:1, DONE:2
};

function updateMessage(state, data) {
    let message;
    switch (state) {
        case courseState.PENDING:
            message = "等待接收课程信息";
            break;
        case courseState.PROCESSING:
            message = `正在进行 课程名称:${data}`;
            break;
        case courseState.DONE:
            message =  "课程结束";
            break;
        default:
            message = "ERROR";
    }
    let p = document.querySelector(".message");
    p.innerHTML = message;
}

function start(){
    let sendDoneButton = document.querySelector(".send-done");
    sendDoneButton.onclick = sendDone;
    sendDoneButton.disabled = true;
    let sendAnswerButton = document.querySelector(".send-answer");
    sendAnswerButton.onclick = sendAnswer;

    updateMessage(courseState.PENDING);
}

function sendAnswer() {
    let answerInput = document.querySelector(".question-options");
    let answer = answerInput.value;

    let sendDoneButton = document.querySelector(".send-done");
    sendDoneButton.disabled = false;

    sendMessgge({answer:answer});
    console.error(`send answer: ${answer}`);
}


function sendDone() {
    let sendDoneButton = document.querySelector(".send-done");
    sendDoneButton.disabled = true;
    let sendAnswerButton = document.querySelector(".send-answer");
    sendAnswerButton.disabled = true;

    updateMessage(courseState.DONE);

    sendMessgge({event:'done'});
    socketClient.end();
    console.error(`send done.`);
}

function sendMessgge(data) {
    let json = JSON.stringify(data);
    socketClient.write(json);
}

function handleServerMessage(message) {
    if(message.course) {
        //开始特定课程
        updateMessage(courseState.PROCESSING, message.course);
    }
}

const socketClient = require('net').connect({port:9100}, () => {
    console.error('connected to server');

    socketClient.on('data', (data) => {
        console.error(`server data: ${data}`);
        handleServerMessage(JSON.parse(data));
    });

});
start();
