"use strict";

const ipcRenderer = require('electron').ipcRenderer;


save_config = () => {
    ipcRenderer.send('config-save', {index: configForm.index.value, server:configForm.server.value});
    return false;
};

show_dialog = (course) => {
    ipcRenderer.send('dialog-show', {name: course});
};
