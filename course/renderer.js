// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

var setting = {
    index:null,

};

var courseState = {
    PROCESSING:1, DONE:2
};

function updateMessage(state) {
    let message;
    switch (state) {
        case courseState.PROCESSING:
            message = "正在进行";
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
    sendDoneButton.addEventListener('click', sendDone);
    sendDoneButton.disabled = true;
    let sendAnswerButton = document.querySelector(".send-answer");
    sendAnswerButton.addEventListener('click', sendAnswer);
    updateMessage(courseState.PROCESSING)
}

function sendAnswer() {
    let answerInput = document.querySelector(".question-options");
    let answer = answerInput.value;

    let sendDoneButton = document.querySelector(".send-done");
    sendDoneButton.disabled = false;

    console.error(`sending answer: ${answer}`);
}


function sendDone() {
    let sendDoneButton = document.querySelector(".send-done");
    sendDoneButton.disabled = true;
    let sendAnswerButton = document.querySelector(".send-answer");
    sendAnswerButton.disabled = true;

    updateMessage(courseState.DONE);

    console.error(`sending done.`);
}

start();