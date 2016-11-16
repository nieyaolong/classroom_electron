"use strict";

let desktopCapturer = require('electron').desktopCapturer;

let overviewPC;
let detailPC;

function getDescEvent(isOverview) {
    return isOverview ? 'overview_desc' : 'detail_desc';
}

function getIceEvent(isOverview) {
    return isOverview ? 'overview_ice' : 'detail_ice';
}


//bug: 无法同时请求同一个视频的两种不同品质的流,考虑overview使用截图实现
function getStreamAsync(name, isOverview) {
    console.error(`getStreamAsync: ${isOverview}`);
    return new Promise((resolve, reject) => {
        desktopCapturer.getSources({
            types: ['window'],
            // thumbnailSize: isOverview ? {width: 150, height: 100} : {width: 800, height: 600}
        }, function (error, sources) {
            if (error) {
                reject(error);
                return;
            }
            // console.log(sources);
            for (let source of sources) {
                //todo
                if (source.name.match(/微信.*/)) {
                    console.log(source);
                    let config;
                    if (isOverview) {
                        config = {
                            audio: false,
                            video: {
                                mandatory: {
                                    chromeMediaSource: 'desktop',
                                    sourceId: source.id,
                                    minWidth: 150,
                                    maxWidth: 150,
                                    minHeight: 100,
                                    maxHeight: 100,
                                    maxFrameRate: 0.5
                                }
                            }
                        }
                    } else {
                        config = {
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
                        }
                    }
                    navigator.getUserMedia(config, resolve, reject);
                    return;
                }
            }
            //get source failed
            reject(new Error("get source failed"));
        })
    });
}

function startAsync(pc, socket, isOverview, name) {
    let DescEvent = getDescEvent(isOverview);
    return getStreamAsync(name, isOverview)
        .then(stream => {

            pc.addStream(stream);

            let offerOptions = {
                offerToReceiveAudio: isOverview ? 0 : 1,
                offerToReceiveVideo: 1
            };

            return pc.createOffer(offerOptions)
                .then((desc) => {
                    return pc.setLocalDescription(desc)
                        .then(() => {
                            console.log(desc);
                            socket.emit(DescEvent, desc);
                        });
                });
        });
}

exports.startPushOverviewSteamAsync = (socket, name) => {
    return startAsync(overviewPC, socket, true, name);
};

// exports.startPushDetailStreamAsync = (socket, name) => {
//     return startAsync(detailPC, socket, false, name);
// };

function createConnection(socket, isOverview) {
    let pc = new webkitRTCPeerConnection(null);

    let IceEvent = getIceEvent(isOverview);
    let DescEvent = getDescEvent(isOverview);
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit(IceEvent, event.candidate);
            console.log(' ICE candidate: \n' + event.candidate.candidate);
        }
    };

    pc.oniceconnectionstatechange = (event) => {
        let state = pc.iceConnectionState;
        console.log(' ICE state: ' + state);
        //todo failed state
    };

    socket.on(DescEvent, (desc) => {
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

exports.createOverviewStream = (socket) => {
    overviewPC = createConnection(socket, true);

    //开始监听detail请求
    socket.on('detail_request', () => {
        //todo check state
        console.log('start push detail stream');

        detailPC = createConnection(socket, false);
        startAsync(detailPC, socket, false, '')
            .then(() => console.log('push detail success.'))
            .catch((err) => console.error(err));
    });
};

// exports.createDetailStream = (socket) => {
//     detailPC = createConnection(socket, false);
// };

function stop(isOverview) {
    let pc = isOverview ? overviewPC : detailPC;
    for (let stream of pc.getLocalStreams()) {
        pc.removeStream(stream);
    }
    pc.close();
}

exports.stopOverviewStream = () => {
    stop(true);
};

exports.stopDetailStream = () => {
    stop(false);
};
