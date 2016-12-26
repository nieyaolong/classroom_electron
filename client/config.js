"use strict";

const fs = require('fs');
const path = require('path');
const ipcRenderer = require('electron').ipcRenderer;
const Config = require('electron-config');
const config = new Config();

const isDev = process.env.NODE_ENV == 'development';

let indexInput = document.getElementsByName('index')[0];
let serverInput = document.getElementsByName('server')[0];
let portInput = document.getElementsByName('port')[0];
let pathInput = document.getElementsByName('course')[0];

if (config.get('index')) {
    indexInput.value = config.get('index');
}
if (config.get('index')) {
    serverInput.value = config.get('server');
}
if (config.get('index')) {
    portInput.value = config.get('server_port');
}
if (config.get('index')) {
    pathInput.value = config.get('course_path');
}

save_config = () => {
    try {
        let courseConfigFile = path.join(configForm.course.value, 'course.json');
        if (!fs.existsSync(courseConfigFile)) {
            //创建配置文件
            //todo course.json config
            let data = fs.readFileSync(path.join(__dirname, isDev ? './default_course_dev.json' : './default_course_prod.json'));
            fs.writeFileSync(courseConfigFile, data);
            alert('已生成默认课程配置文件');
        }
    } catch (err) {
        console.error(err);
        alert('保存失败');
        return false;
    }

    ipcRenderer.send('config-save', {
        index: configForm.index.value,
        server: configForm.server.value,
        port: configForm.port.value,
        course: configForm.course.value
    });
    return false;
};

show_dialog = () => {
    try {
        let result = ipcRenderer.sendSync('dialog-show');
        if (!result) {
            return;
        }
        //检测合法性
        let courseConfigFile = path.join(result, 'course.json');

        if (fs.existsSync(courseConfigFile)) {
            let config = require(courseConfigFile);
            if (!config["courses"]) {
                alert('课程配置文件格式错误');
                return;
            }
        }
        pathInput.value = result;
    } catch (err) {
        console.error(err);

    }
};
