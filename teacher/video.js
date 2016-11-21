"use strict";

const nativeImage = require('electron').nativeImage;

const DESC_EVENT = "VIDEO_DESC";
const ICE_EVENT = "VIDEO_ICE";
const THUMBNAIL_DATA = "VIDEO_THUMBNAIL";
const THUMBNAIL_FAIL = "VIDEO_FAIL";
const THUMBNAIL_DATA_RECV = "VIDEO_THUMBNAIL_RECV";
const STREAM_START_EVENT = "VIDEO_START";
const STREAM_STOP_EVENT = "VIDEO_STOP";

let pc;
let currentStreamInfo = {index:null, socket:null};

function setThumbnailURL(index, data) {
    if(data) {
        let img = nativeImage.createFromBuffer(data);
        updateThumbnail(index, img.toDataURL());
    } else{
        updateThumbnail(index, null);
    }
}

function createStreamConnection(socket) {

    let pc = new webkitRTCPeerConnection(null);

    socket.on(ICE_EVENT, (candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(' ICE candidate: ' + candidate.candidate);
    });

    socket.on(DESC_EVENT, (desc) => {
        pc.setRemoteDescription(desc).then(
            () => {
                console.log('pc on set remote desc success');
            }
        );

        pc.createAnswer().then((desc) => {
            pc.setLocalDescription(desc).then(
                () => {
                    console.log('pc on set local desc');
                    socket.emit(DESC_EVENT, desc);
                }
            );
        });
    });

    pc.oniceconnectionstatechange = () => {
        let state = pc.iceConnectionState;
        console.log(' ICE state: ' + state);
        if(state === 'failed') {
            updateVideo(null);
        }
    };

    pc.onaddstream = (e) => {
        let url = URL.createObjectURL(e.stream);
        console.log('pc received remote stream: ' + url);
        updateVideo(url);
    };

    pc.onremoveStream = () => {
        updateVideo(null);
    };

    return pc;
}

//初始化
exports.init = (index, socket) => {

    //监听截图事件
    socket.on(THUMBNAIL_DATA, data => {
        setThumbnailURL(index, data.data);
        //数据接收回馈
        socket.emit(THUMBNAIL_DATA_RECV);
    });

    socket.on(THUMBNAIL_FAIL, () => {
        //todo show fail info;
        console.error(`thumbnail failed: ${index}`);
    });

};

//服务端主动请求开始流
exports.requestStreamStart = (index, socket) => {
    pc = createStreamConnection(socket);
    currentStreamInfo.index = index;
    currentStreamInfo.socket = socket;
    socket.emit(STREAM_START_EVENT);
};

//服务端主动请求关闭流
exports.requestStreamStop = () => {
    //关闭显示
    updateVideo(null);
    //发送关闭流请求
    socket.emit(STREAM_STOP_EVENT);
    if(pc) {
        pc.close();
    }
    pc = null;
    currentStreamInfo.index = null;
    currentStreamInfo.socket = null;
};

//当socket连接断开时触发,安全保护
exports.destroy = (index) => {

    setThumbnailURL(index, null);
    if(index && currentStreamInfo.index == index) {
        setThumbnailURL(index, null);
    }
    if(pc) {
        pc.close();
    }
    currentStreamInfo.index = null;
    currentStreamInfo.socket = null;
};