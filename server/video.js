"use strict";

const nativeImage = require('electron').nativeImage;

const DESC_EVENT = "VIDEO_DESC";
const ICE_EVENT = "VIDEO_ICE";
const THUMBNAIL_DATA = "VIDEO_THUMBNAIL";
const THUMBNAIL_DATA_RECV = "VIDEO_THUMBNAIL_RECV";
const STREAM_START_EVENT = "VIDEO_START";
const STREAM_STOP_EVENT = "VIDEO_STOP";
const STREAM_FAIL_EVENT = "VIDEO_FAIL";

// server端始终使用一个PC, 使用pcState保证pc只能同时和一个对端通信
// 当state处于除IDLE和FAIL以外的状态时,index和socket可用
// IDLE状态:空闲状态,没有视频播放
// CONNECTING:正在主动建立连接,包括正在等待对端回应
// STABLE:连接已建立,视频正在播放中
// CLOSING:正在主动关闭连接,包括等在对端回应
// FAILED: 连接异常,可能是socket断开了,或者等待对端请求超时
// 状态机: IDLE--> CONNECTING --> STABLE --> CLOSING --> IDLE <-- FAIL
//                   |______________|_________|____________________^

const PCState = {
    IDLE: 1, CONNECTING: 2, STABLE: 3, CLOSING: 4, FAILED: 5
};

let PCStateCB = [null, null, null, null, null];

const WAITNG_TIME = 10000; //10秒

const pc = createPC();

let currentStreamInfo = {
    index: null,
    state: PCState.IDLE
};

function updatePCState(state, index) {
    console.log(`UPDATEING PC STATE: ${state} , ${index}, ${JSON.stringify(currentStreamInfo)}`);
    switch (state) {
        case PCState.IDLE:
        case PCState.FAILED:
            currentStreamInfo.state = state;
            currentStreamInfo.index = null;
            break;
        case PCState.CONNECTING:
            if (!index) {
                console.error('BUG: bad index of socket on update PCState');
            }
            if (currentStreamInfo.state == PCState.FAILED) {
                console.error('BUG: wrong state');
                return;
            }
            currentStreamInfo.state = state;
            currentStreamInfo.index = index;
            break;
        case PCState.STABLE:
        case PCState.CLOSING:
            if (currentStreamInfo.state == PCState.FAILED) {
                console.error('BUG: wrong state');
                return;
            }
            currentStreamInfo.state = state;
            break;
        default:
            console.error('BUG: bad pc state');
    }
    //回调函数
    if (PCStateCB[state]) {
        PCStateCB[state]();
    }
}

function setThumbnailURL(index, data) {
    if (data) {
        let img = nativeImage.createFromBuffer(data);
        updateThumbnail(index, img.toDataURL());
    } else {
        updateThumbnail(index, null);
    }
}

function createPC() {

    let pc = new webkitRTCPeerConnection(null);

    pc.oniceconnectionstatechange = () => {
        let state = pc.iceConnectionState;
        console.log(' ICE state: ' + state);
        if (state === 'disconnected') {
            //ice state状态处于disconnecte状态时标志着pc处于空闲状态
            updateVideo(null);
            updatePCState(PCState.IDLE);
        } else if (state == 'connected') {
            //ice state状态处于connected状态时标志着pc处于STABLE状态
            updatePCState(PCState.STABLE);
        }
    };


    pc.onaddstream = (e) => {
        console.log('pc on addstream');
        let url = URL.createObjectURL(e.stream);
        console.log('pc received remote stream: ' + url);
        updateVideo(url);
    };

    pc.onremoveStream = () => {
        console.log('pc on remove stream');
        updateVideo(null);
    };

    return pc;
}

function hookSocket(socket) {
    //thumbnail event
    //监听截图事件
    socket.on(THUMBNAIL_DATA, data => {
        setThumbnailURL(socket.index, data.data);
        //数据接收回馈
        socket.emit(THUMBNAIL_DATA_RECV);
    });

    // stream event
    socket.on(ICE_EVENT, (candidate) => {
        if (currentStreamInfo.index != socket.index) {
            console.error(`WARNING: unexpected ICE_EVENT from socket ${socket.index}, current: ${currentStreamInfo.index}`);
            return;
        }
        pc.addIceCandidate(new RTCIceCandidate(candidate));
        // console.log(' ICE candidate: ' + candidate.candidate);
    });

    socket.on(DESC_EVENT, (desc) => {
        if (currentStreamInfo.index != socket.index) {
            console.error(`WARNING: unexpected DESC_EVENT from socket ${socket.index}, current: ${currentStreamInfo.index}`);
            return;
        }
        pc.setRemoteDescription(desc).then(
            () => {
                console.log('pc on set remote desc success');
            }
        ).catch(err => {
            console.error(err);
        });
    });
}

function createAndSendOfferAsync(socket) {
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
}

//初始化
exports.init = (socket) => {
    hookSocket(socket);
};

//服务端主动请求开始流
function requestStreamStartAsync(index, socket) {
    if (currentStreamInfo.state != PCState.IDLE) {
        return Promise.reject(new Error('BAD PC STATE'));
    }
    console.log(`request start stream ${index}`);
    return new Promise((resolve, reject) => {
        //挂载cb
        PCStateCB[PCState.STABLE] = () => {
            //成功开始
            resolve();
        };

        PCStateCB[PCState.FAILED] = () => {
            reject(new Error('start stream failed: pc state failed'));
        };

        updatePCState(PCState.CONNECTING, index);
        createAndSendOfferAsync(socket)
            .then(() => {
                socket.emit(STREAM_START_EVENT, index);
            }).catch(err => {
            console.error(err);
            //请求开始视频出现异常
            updatePCState(PCState.FAILED);
        });
        //超时处理
        setTimeout(() => {
            if (currentStreamInfo.state == PCState.CONNECTING) {
                //仍处于连接状态,超时
                updatePCState(PCState.FAILED);
                console.error('TIMEOUT')
            }
        }, WAITNG_TIME);
    }).then(() => {
        PCStateCB[PCState.STABLE] = null;
        PCStateCB[PCState.FAILED] = null;
    }).catch(err => {
        PCStateCB[PCState.STABLE] = null;
        PCStateCB[PCState.FAILED] = null;
        updatePCState(PCState.IDLE);
        return Promise.reject(err);
    });
}

//服务端主动请求关闭流
function requestStreamStopAsync(index, socket) {
    if (currentStreamInfo.state != PCState.STABLE) {
        return Promise.reject(new Error('BAD PC STATE'));
    }
    console.log(`request stop stream ${currentStreamInfo.index}`);

    return new Promise((resolve, reject) => {
        //挂载cb
        PCStateCB[PCState.IDLE] = () => {
            //成功关闭,pc回到空闲状态
            resolve();
        };

        PCStateCB[PCState.FAILED] = () => {
            reject(new Error('stop stream failed: pc state failed'));
        };

        //发送关闭流请求
        updatePCState(PCState.CLOSING);
        socket.emit(STREAM_STOP_EVENT, index);
        //超时处理
        setTimeout(() => {
            if (currentStreamInfo.state == PCState.CLOSING) {
                //仍处于待关闭状态,超时
                updatePCState(PCState.FAILED);
                console.error('TIMEOUT')
            }
        }, WAITNG_TIME);
    }).then(() => {
        PCStateCB[PCState.IDLE] = null;
        PCStateCB[PCState.FAILED] = null;
    }).catch(err => {
        PCStateCB[PCState.IDLE] = null;
        PCStateCB[PCState.FAILED] = null;
        updatePCState(PCState.IDLE);
        return Promise.reject(err);
    });
}

exports.requestStream = (index, socket) => {
    if (currentStreamInfo.state == PCState.IDLE) {
        //pc空闲,可开始视频
        requestStreamStartAsync(index, socket)
            .then(() => {
                console.log('request start stream success')
            })
            .catch(err => {
                console.error(err)
            });
    } else if (currentStreamInfo.state == PCState.STABLE && currentStreamInfo.index == index) {
        requestStreamStopAsync(index, socket)
            .then(() => {
                console.log('request stop stream success')
            })
            .catch(err => {
                console.error(err)
            });
    } else {
        console.error(`request stream ignored: ${JSON.stringify(currentStreamInfo)}, ${index}`)
    }
};

//当socket连接断开时触发
exports.destroy = (index) => {
    setThumbnailURL(index, null);

    if (currentStreamInfo.index == index) {
        //正在播放视频对端出现异常
        //关闭显示
        updateVideo(null);
        //状态更新
        if (currentStreamInfo.state != PCState.IDLE && currentStreamInfo.state != PCState.FAILED) {
            updatePCState(PCState.IDLE);
        }
    }
    console.log(`destroy video ${index}`);
};