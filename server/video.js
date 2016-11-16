"use strict";

let PCMap = new Map();

function createStreamConnection(index, socket, isOverview) {
    let IceEvent = isOverview ? 'overview_ice' : 'detail_ice';
    let DescEvent = isOverview ? 'overview_desc' : 'detail_desc';

    let pc = new webkitRTCPeerConnection(null);

    socket.on(IceEvent, (candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(' ICE candidate: ' + candidate.candidate);
    });

    socket.on(DescEvent, (desc) => {
        pc.setRemoteDescription(desc).then(
            () => {
                console.log('pc on set remote desc success');
            }
        );

        pc.createAnswer().then((desc) => {
            // console.log('Answer from remote:\n' + desc.sdp);
            pc.setLocalDescription(desc).then(
                () => {
                    console.log('pc on set local desc');
                    socket.emit(DescEvent, desc);
                }
            );
        });
    });

    pc.oniceconnectionstatechange = (event) => {
        let state = pc.iceConnectionState;
        console.log(' ICE state: ' + state);
        if(state === 'failed') {
            updateVideo(index, null, isOverview);
        }
    };

    pc.onaddstream = (e) => {
        let url = URL.createObjectURL(e.stream);
        console.log('pc received remote stream: ' + url);
        updateVideo(index, url,isOverview);
    };

    pc.onremoveStream = (e) => {
        updateVideo(index, null,isOverview);
    };

    return pc;
}

exports.init = (index, socket) => {
    let pcInfo = PCMap.get(index);
    if(!pcInfo) {
        pcInfo = {overview:null, detail:null, socket: socket};
    }
    pcInfo.overview = createStreamConnection(index, socket, true);
    PCMap.set(index, pcInfo);
};

exports.requestDetailStream = (index) => {
    let pcInfo = PCMap.get(index);
    if(!pcInfo || !pcInfo.socket) {
        console.error('bad connect state');
        return;
    }
    pcInfo.detail = createStreamConnection(index, pcInfo.socket, false);
    pcInfo.socket.emit('detail_request');
};

exports.destroy = (index) => {
    let pcInfo = PCMap.get(index);
    if(!pcInfo) {
        return;
    }

    updateVideo(index, null, true);
    updateVideo(index, null, false);
    if(pcInfo.overview) pcInfo.overview.close();
    if(pcInfo.detail) pcInfo.detail.close();
    PCMap.delete(index);
};