import React, { useState, useEffect } from "react";
import Map from "./Map";
import DraggableDiv from "../Components/DraggableDiv";
import { Mic, MicOff, Video, VideoOff } from "react-feather";
import { useSocket } from "../ContextApi/SocketProvider";
import VideoCall from '../Components/VideoCall'
import Chat from "../Components/Chat";
export const VideoFrame = () => {
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(true);
    const { remoteStream,myStream,setMyStream } = useSocket();
    // const [myStream,setMyStream]=useState(null);
    // const EnterRoom = async () => {

    //     const stream = await navigator.mediaDevices.getUserMedia({
    //       audio: true,
    //       video: true,
    //     });
    //     console.log("enterRoom", stream);
    
    //     // localStorage.setItem("stream",stream);
    //     if (myStream === null)
    //       setMyStream(stream);
    //   }
    //   useEffect(() => {
    //     console.log("myStream useEffect ", myStream);
    //     EnterRoom();
    //   }, [myStream])

    const toggleMic = () => {
        if (myStream) {
            const audioTrack = myStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicOn(audioTrack.enabled);
            }
        }
    };

    const toggleCam = () => {
        if (myStream) {
            const videoTrack = myStream.getVideoTracks()[0];
            console.log("videoTrack ", videoTrack);
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCamOn(videoTrack.enabled);
                console.log("videoTrack ", videoTrack);
            }
            setMyStream(myStream);
        }

    };
    



    return (
        <div className="video-call-container" >
            <div className="video-frame">
                <Map />
            </div>
            <VideoCall />
            <Chat roomId={"1"}/>
             <DraggableDiv Stream={myStream} isCamOn={isCamOn} />
            {remoteStream!=null && <DraggableDiv Stream={remoteStream} />}


            <div className="footer">
                <button className="audio-button" onClick={toggleMic}>
                    {!isMicOn ? (
                        <MicOff size={20} color="white" />
                    ) : (
                        <Mic size={20} color="white" />
                    )}
                </button>
                <button className="audio-button" onClick={toggleCam}>
                    {!isCamOn ? (
                        <VideoOff size={20} color="white" />
                    ) : (
                        <Video size={20} color="white" />
                    )}
                </button>
            </div>
        </div>
    );
};

export default VideoFrame;
