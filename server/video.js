"use strict";

const nativeImage = require('electron').nativeImage;

const DESC_EVENT = "VIDEO_DESC";
const ICE_EVENT = "VIDEO_ICE";
const THUMBNAIL_DATA = "VIDEO_THUMBNAIL";
const THUMBNAIL_FAIL = "VIDEO_FAIL";
const THUMBNAIL_DATA_RECV = "VIDEO_THUMBNAIL_RECV";
const STREAM_START_EVENT = "VIDEO_START";
const STREAM_STOP_EVENT = "VIDEO_STOP";

let pcMap = new Map();
let currentStreamInfo = {index: null, socket: null};

function setThumbnailURL(index, data) {
    if (data) {
        let img = nativeImage.createFromBuffer(data);
        updateThumbnail(index, img.toDataURL());
    } else {
        updateThumbnail(index, null);
    }
}

function createStreamConnection(socket) {

    let pc = new webkitRTCPeerConnection(null);

    socket.on(ICE_EVENT, (candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
        // console.log(' ICE candidate: ' + candidate.candidate);
    });

    socket.on(DESC_EVENT, (desc) => {
        console.log('socket on desc');
        pc.setRemoteDescription(desc).then(
            () => {
                console.log('pc on set remote desc success');
            }
        ).catch(err => {
            console.error(err);
        });
    });

    pc.oniceconnectionstatechange = () => {
        let state = pc.iceConnectionState;
        console.log(' ICE state: ' + state);
        if (state === 'failed') {
            updateVideo(null);
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

function createAndSendOfferAsync(pc, socket) {
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

    let pc = createStreamConnection(socket);
    pcMap.set(index, pc);
};

//服务端主动请求开始流
exports.requestStreamStart = (index, socket) => {
    let pc = pcMap.get(index);
    if (!pc) {//TODO: check pc state
        console.error('bug:bad index, request stream failed');
    }
    createAndSendOfferAsync(pc, socket)
        .then(() => {
            currentStreamInfo.index = index;
            currentStreamInfo.socket = socket;
            socket.emit(STREAM_START_EVENT);
            console.log(`start request stream ${index}`);
        }).catch(err => {
            console.error(err);
    })
};

//服务端主动请求关闭流
exports.requestStreamStop = () => {
    if (!currentStreamInfo.socket) {//TODO: check pc state
        console.error('bug:stop stream failed, miss socket');
    }
    //关闭显示
    updateVideo(null);
    //发送关闭流请求
    currentStreamInfo.socket.emit(STREAM_STOP_EVENT);
    currentStreamInfo.index = null;
    currentStreamInfo.socket = null;
};

//当socket连接断开时触发,安全保护
exports.destroy = (index) => {

    setThumbnailURL(index, null);
    if (index && currentStreamInfo.index == index) {
        setThumbnailURL(index, null);
    }
    let pc = pcMap.delete(index);
    if (pc) {
        pc.close();
    }
    currentStreamInfo.index = null;
    currentStreamInfo.socket = null;
    console.log(`destroy video ${index}`);
};