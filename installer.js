"use strict";

var electronInstaller = require("electron-winstaller");

let promise = electronInstaller.createWindowsInstaller({
    appDirectory: 'package/classroomClient-win32-x64',
    outputDirectory: 'installer',
    authors: '威爱教育',
    owners: '威爱教育',
    title: '威爱通',
    description: '威爱通客户端应用程序',
    exe: 'classroomClient.exe',
    // iconUrl: 'client/img/classroom.ico',
    setupIcon : 'client/img/classroom.ico',
    setupExe:'clientSetup.exe',
    noMsi: true,
});

promise.then(() => {
    console.log('done.');
}).catch(err => {
    console.error(err);
});