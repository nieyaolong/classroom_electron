"use strict";
const electron = require('electron')
// Module to control application life.
const app = electron.app;
const Tray = electron.Tray;
const Menu = electron.Menu;
const globalShortcut = electron.globalShortcut;
const Dialog = electron.dialog;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const path = require('path');
const Config = require('electron-config');
const config = new Config();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({width: 1366, height: 768, resize:false, frame:(process.platform != 'win32')});

    mainWindow.loadURL(`file://${__dirname}/login.html`);
    mainWindow.setMenu(null);

    globalShortcut.register('alt+d', function () {
        mainWindow.webContents.openDevTools()
    });


    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
        app.quit()
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow()
    }
})


// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

if (process.platform == 'win32') {
    let tray = null;
    app.on('ready', () => {
        tray = new Tray(path.join(__dirname, '/img/classroom.ico'));
        const contextMenu = Menu.buildFromTemplate([
            {
                label: '登出', type: 'normal', click: ()=> {
                mainWindow.loadURL(`file://${__dirname}/login.html`)
            }
            },
            {
                label: '配置路径', type: 'normal', click: ()=> {
                    Dialog.showOpenDialog({properties: ['openFile'], filters: [{name:'EXE', extensions:['exe']}]}, (fileName)=> {
                        if(fileName && fileName.length > 0) {
                            config.set('courses.english', fileName[0]);
                        }
                    })
            }
            },
            {
                label: '退出', type: 'normal', click: ()=> {
                app.exit(0)
            }
            }
        ]);
        tray.setToolTip('威爱教室客户端');
        tray.setContextMenu(contextMenu);
    });
}