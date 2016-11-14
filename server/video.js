"use strict";

var pc;

exports.listenOverviewStream = (index, socket, urlCallback) => {
};


function gotRemoteStream(e) {
    var remoteVideo = document.getElementById('video_1');
    remoteVideo.src = URL.createObjectURL(e.stream);
    console.log('pc received remote stream: ' + remoteVideo.src);
}

function onIceStateChange(event) {
    console.log(' ICE state: ' + pc.iceConnectionState);
    console.log('ICE state change event: ', event);
}

exports.createOverviewConnection = (socket) => {
    pc = new webkitRTCPeerConnection(null);

    socket.on('ice', (candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(' ICE candidate: \n' + candidate.candidate);
    });

    socket.on('desc', (desc) => {
        console.log('Offer from remote:' + desc.sdp);

        pc.setRemoteDescription(desc).then(
            () => {
                console.log('pc on set remote desc success');
            }
        );

        pc.createAnswer().then((desc) => {
            console.log('Answer from remote:\n' + desc.sdp);
            pc.setLocalDescription(desc).then(
                () => {
                    console.log('pc on set local desc');
                    console.log('remote setRemoteDescription start');
                    socket.emit('desc', desc);
                }
            );
        });
    });

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit(event.candidate);
        }
    };

    pc.oniceconnectionstatechange = (e) => {
        onIceStateChange(e);
    };

    pc.onaddstream = gotRemoteStream;

};

exports.destroyOverviewStreamConnection = (index) => {
};