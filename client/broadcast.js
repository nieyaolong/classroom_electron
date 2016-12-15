/**
 * 语音广播模块
 */

"use strict";

const BC_DESC_EVENT = "BC_DESC";
const BC_ICE_EVENT = "BC_ICE";

let pc;

exports.start = (socket) => {
    socket.removeAllListeners(BC_DESC_EVENT);
    socket.once(BC_DESC_EVENT, (desc) => {
        //recv offer, create pc
        pc = new webkitRTCPeerConnection(null);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit(BC_ICE_EVENT, event.candidate);
                // console.log(' ICE candidate: \n' + event.candidate.candidate);
            }
        };

        pc.oniceconnectionstatechange = () => {
            let state = pc ? pc.iceConnectionState : null;
            console.log('BC ICE state: ' + state);
        };

        pc.setRemoteDescription(desc)
            .catch(err => {
                console.error(err);
            });

        pc.onaddstream = e => {
            //播放对端音频
            document.getElementById('bc_audio').setAttribute('src', URL.createObjectURL(e.stream));
        };

        pc.createAnswer()
            .then((answer) => {
                return pc.setLocalDescription(answer)
                    .then(() => {
                        socket.emit(BC_DESC_EVENT, answer);
                        // console.error('send broadcast answer: %o', answer);
                    });
            });
    });
};

exports.stop = (socket) => {
    if(pc) {
        pc.close();
        document.getElementById('bc_audio').setAttribute('src', null);
        pc = null;
    }
    socket.removeAllListeners(BC_DESC_EVENT);
};
