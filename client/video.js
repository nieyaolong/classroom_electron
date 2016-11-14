"use strict";

var desktopCapturer = require('electron').desktopCapturer;

function getStream(callback) {
    desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: {width: 150, height: 100}
    }, function (error, sources) {
        if (error) {
            callback(error);
            return;
        }
        for (var i = 0; i < sources.length; ++i) {
            //todo
            if (sources[i].id === `window:${34234}`) {
                console.log(sources[i]);
                navigator.webkitGetUserMedia({
                    audio: false,
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: sources[i].id,
                            minWidth: 100,
                            maxWidth: 150,
                            minHeight: 100,
                            maxHeight: 100,
                            maxFrameRate: 0.5
                        }
                    }
                }, function (stream) {
                    //success
                    callback(null, stream);
                }, callback);
                return;
            }
        }
        //get source failed
        callback(new Error("get source failed"));
    })
}

var pc;

exports.startPushOverViewStream = (window_handler, socket, successCallback, failCallback) => {
    getStream((err, stream) => {
        if (err) {
            failCallback(err);
            return;
        }
        pc.addStream(stream);

        let offerOptions = {
            offerToReceiveAudio: 1,
            offerToReceiveVideo: 1
        };


        pc.createOffer(offerOptions).then(
            (desc) => {
                pc.setLocalDescription(desc).then(
                     () => {
                        console.log('pc on set local desc');
                    }).catch(err => {
                    console.error(err);
                });

                socket.emit('desc', desc);
                console.log('socket send desc')
            }
        ).catch(err => {
            console.error(err);
        });

        successCallback();
    })
};

exports.createOverviewConnection = (socket) => {
    pc = new webkitRTCPeerConnection(null);
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice', event.candidate);
            console.log(' ICE candidate: \n' + event.candidate.candidate);
        }
    };

    pc.oniceconnectionstatechange = (event) => {
        trace(' ICE state: ' + pc.iceConnectionState);
        console.log('ICE state change event: ', event);
    }


    socket.on('desc', (desc) => {
        console.log(desc);
        pc.setRemoteDescription(desc).then(
            () => {
                console.log('pc on set remote desc success');
            }
        ).catch(err => {
            console.error(err);
        });
    });

    console.log('pc created');
};

// exports.stopPushOverViewStream = () => {
// };