"use strict";

const desktopCapturer = require('electron').desktopCapturer;

const DESC_EVENT = "VIDEO_DESC";
const ICE_EVENT = "VIDEO_ICE";
const THUMBNAIL_DATA = "VIDEO_THUMBNAIL";
const THUMBNAIL_DATA_RECV = "VIDEO_THUMBNAIL_RECV";
const STREAM_STOP_EVENT = "VIDEO_STOP";
const STREAM_REMOTE_EVENT = "VIDEO_REMOTE_RESULT";

//客户端状态有以下几种情况:
//1.课程未开始状态,既不随同缩略图也不监听视频请求
//2.缩略图推送状态,不简历pc连接,此时pc应为null
//3.监控状态,缩略图和视频同时工作
//状态机
// 应为 1-->2-->3-->2-->1
//当连接意外中断时,若在状态3,则自动回退到状态2,若在状态1,2 则无需操作

//当前进行播放的源信息
let sourceInfo;

function getWindowSourceAsync() {
    if (!sourceInfo) {
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
                if (!sourceInfo) {
                    break;
                }
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
        if (sourceInfo) {
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
            }).catch(err => {
            // console.log(err);
            //发送截图失败,稍后重试
            delayRetry();
        });
    }

    socket.once(THUMBNAIL_DATA_RECV, delayRetry);
    send();
}

function getStreamAsync() {
    return new Promise((resolve, reject) => {
        return getWindowSourceAsync()
            .then(source => {
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

function waitOfferAsync(socket) {
    return new Promise((resolve, reject) => {
        socket.once(DESC_EVENT, (desc) => {
            //只接收一次offer,其他丢弃
            //recv offer, create pc
            let pc = new webkitRTCPeerConnection(null);

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit(ICE_EVENT, event.candidate);
                    // console.log(' ICE candidate: \n' + event.candidate.candidate);
                }
            };

            pc.oniceconnectionstatechange = () => {
                let state = pc.iceConnectionState;
                console.log(' ICE state: ' + state);
                if (state == 'disconnected') {
                    //连接中断,关闭并删除pc
                    pc.close();
                    pc = null;
                }
            };

            pc.setRemoteDescription(desc).then(
                () => {
                    console.log('pc on set remote desc success');
                });
            //获取pc
            resolve(pc);
        });
    });
}

//等待请求视频-->播放视频-->等待关闭视频-->关闭视频 循环
//直到课程结束退出
//
function playVideoLoop(socket) {
    //等待对端发起Offer
    return waitOfferAsync(socket)
        .then(pc => {
            //pc建立完成,开始获取视频流
            return getStreamAsync()
                .then(stream => {
                    //添加视频流并回应offer
                    pc.addStream(stream);
                    return pc.createAnswer()
                        .then((answer) => {
                            return pc.setLocalDescription(answer)
                                .then(() => {
                                    console.log('pc on set local desc');
                                    socket.emit(DESC_EVENT, answer);
                                    console.log('start stream success');

                                    //连接建立完成,等待结束请求
                                    //监听关闭流请求
                                    return new Promise((resolve, reject) => {
                                        socket.once(STREAM_STOP_EVENT, () => {
                                            //只接收第一次消息,其他丢弃
                                            if (pc) {
                                                pc.close();
                                                pc = null;
                                                console.log('stop stream success');
                                                //流程正常结束,等待再次建立连接
                                                resolve();
                                            }
                                        });
                                    });
                                });
                        });
                });
        }).then(() => {
            //一次播放正常结束, 如果课程仍在进行,则重入循环
            if (sourceInfo) {
                playVideoLoop(socket)
            } else {
                removeSocketEvent(socket);
            }
        }).catch(err => {
            console.error(err);
            //一次播放异常结束, 如果课程仍在进行,则重入循环
            if (sourceInfo) {
                playVideoLoop(socket)
            } else {
                removeSocketEvent(socket);
            }
        })
}

//课程未开始状态下不坚挺视频流相关事件,直接给结果
function removeSocketEvent(socket) {
    if (!sourceInfo) {
        //视频关闭事件,直接返回成功
        socket.on(STREAM_STOP_EVENT, () => {
            socket.emit(STREAM_REMOTE_EVENT, true);
        });
        //视频开始事件
        socket.on(DESC_EVENT, () => {
            socket.emit(STREAM_REMOTE_EVENT, false);
        });
    }
}

//课程开始,推送缩略图并等待视频请求
exports.start = (socket, name) => {
    //获取当前窗口source,开始截图推送流程,并监听流请求
    sourceInfo = {name: name};
    pushThumbnailLoop(socket);

    //进入播放视频流程,直到课程结束
    playVideoLoop(socket);
};

//课程结束,停止缩略图,当收到视频请求时直接返回结果
exports.stop = (socket) => {
    sourceInfo = null;
    clearStreamRequest(socket);
    console.log('stop stream success');
};