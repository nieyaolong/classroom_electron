"use strict";

const desktopCapturer = require('electron').desktopCapturer;

const DESC_EVENT = "VIDEO_DESC";
const ICE_EVENT = "VIDEO_ICE";
const THUMBNAIL_DATA = "VIDEO_THUMBNAIL";
const THUMBNAIL_FAIL = "VIDEO_FAIL";
const THUMBNAIL_DATA_RECV = "VIDEO_THUMBNAIL_RECV";
const STREAM_START_EVENT = "VIDEO_START";
const STREAM_STOP_EVENT = "VIDEO_STOP";

let pc;
//当前进行播放的源信息
let sourceInfo;

function getWindowSourceAsync() {
    if(!sourceInfo) {
        return Promise.reject(new Error("bad source info"));
    }
    return new Promise((resolve, reject) => {
        desktopCapturer.getSources({
            types: ['window'],
            thumbnailSize: {width: 150, height: 100}
        }, (error, sources) => {
            if (error) {
                reject(error);
                return;
            }
            let s = null;
            for (let source of sources) {
                if (sourceInfo.id && source.id === sourceInfo.id) {
                    s = source;
                    break;
                } else if (source.name.match(new RegExp(`${sourceInfo.name}.*`))) {
                    s = source;
                    break;
                }
            }
            if (s) {
                sourceInfo.id = s.id;
                resolve(s);
            } else {
                reject(new Error("get source failed"));
            }
        });
    });
}

function pushThumbnailLoop(socket) {
    function delayRetry() {
        if(sourceInfo) {
            //2秒后在再发送
            setTimeout(send, 2000);
        }
    }

    function send() {
        getWindowSourceAsync()
            .then(source => {
                //todo 动态压缩率
                let jpeg = source.thumbnail.toJpeg(100);
                socket.emit(THUMBNAIL_DATA, {data: jpeg})
            })
            .catch(err => {
                console.log(err);
                socket.emit(THUMBNAIL_FAIL);
                //发送截图失败,稍后重试
                delayRetry();
            });
    }

    socket.on(THUMBNAIL_DATA_RECV, delayRetry);
    send();
}

function getStreamAsync() {
    return new Promise((resolve, reject) => {
        return getWindowSourceAsync()
            .then(source => {
                console.error(source);
                let config = {
                    audio: false,
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            sourceId: source.id,
                            minWidth: 800,
                            maxWidth: 800,
                            minHeight: 600,
                            maxHeight: 600
                        }
                    }
                };
                navigator.getUserMedia(config, resolve, reject);
            });
    });
}

function startStreamAsync(socket) {
    return getStreamAsync()
        .then(stream => {

            pc.addStream(stream);

            let offerOptions = {
                offerToReceiveAudio: 1,
                offerToReceiveVideo: 1
            };

            return pc.createOffer(offerOptions)
                .then((desc) => {
                    return pc.setLocalDescription(desc)
                        .then(() => {
                            socket.emit(DESC_EVENT, desc);
                        });
                });
        });
}

function createConnection(socket) {
    pc = new webkitRTCPeerConnection(null);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit(ICE_EVENT, event.candidate);
            console.log(' ICE candidate: \n' + event.candidate.candidate);
        }
    };

    pc.oniceconnectionstatechange = () => {
        let state = pc.iceConnectionState;
        console.log(' ICE state: ' + state);
        //todo failed state
    };

    socket.on(DESC_EVENT, (desc) => {
        pc.setRemoteDescription(desc).then(
            () => {
                console.log('pc on set remote desc success');
            }
        ).catch(err => {
            console.error(err);
        });
    });
    console.log('pc created');

    return pc;
}

exports.start = (socket, name) => {
    //获取当前窗口source,开始截图推送流程,并监听流请求
    //todo source info
    sourceInfo = {name: name};
    pushThumbnailLoop(socket);

    //监听开始流请求
    socket.on(STREAM_START_EVENT, () => {
        //todo check state
        console.log('start push stream');

        pc = createConnection(socket);

        startStreamAsync(socket)
            .then(() => console.log('push stream success.'))
            .catch((err) => console.error(err));
    });

    //监听关闭流请求
    socket.on(STREAM_STOP_EVENT, this.stop);
};

exports.stop = () => {
    if(!pc) {
        return;
    }
    for (let stream of pc.getLocalStreams()) {
        pc.removeStream(stream);
    }
    pc.close();
    pc = null;
    sourceInfo = null;
};

