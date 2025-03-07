import React, { useState, useMemo,useEffect } from "react";
import Map from "./Map";
import { Mic, MicOff, Video, VideoOff } from "react-feather";
import { useSocket } from "../ContextApi/SocketProvider";
import { useVideo } from "../ContextApi/VideoControl";

export const VideoFrame = () => {


    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(true);
    const {producersRef,streamRef,socket, } = useSocket();
    const {videoControl,setVideoControl}=useVideo();

        console.log("isCamOn ",streamRef,"  ",socket.id);
  
    
    const toggleVideo = async () => {
        try {
          if (streamRef.current) {
            const videoTrack = streamRef.current.getVideoTracks()[0];
            if (videoTrack) {
              videoTrack.enabled = !videoTrack.enabled;
              // setIsVideoEnabled(videoTrack.enabled);
    
              // If we have a video producer, pause/resume it
              const videoProducer = producersRef.current.get('video');
              if (videoProducer) {
                if (videoTrack.enabled) {
                  await videoProducer.resume();
                } else {
                  await videoProducer.pause();
                }
                setVideoControl(!videoControl);
                socket.current?.emit("video-pause", {roomID:localStorage.getItem('roomID')});
              }
            }
          }
        } catch (err) {
          console.error("Error toggling video:", err);
          setError("Failed to toggle video");
        }
      };
    
      const toggleAudio = async () => {
        try {
          if (streamRef.current) {
            const audioTrack = streamRef.current.getAudioTracks()[0];
            if (audioTrack) {
              audioTrack.enabled = !audioTrack.enabled;
              // setIsAudioEnabled(audioTrack.enabled);
    
              // If we have an audio producer, pause/resume it
              const audioProducer = producersRef.current.get('audio');
              if (audioProducer) {
                if (audioTrack.enabled) {
                  await audioProducer.resume();
                } else {
                  await audioProducer.pause();
                }
              }
            }
          }
        } catch (err) {
          console.error("Error toggling audio:", err);
          setError("Failed to toggle audio");
        }
      };
    

    const toggleMic = () => {
        toggleAudio();
        localStorage.setItem('isMicOn',!isMicOn);
        setIsMicOn(!isMicOn);
    };

    const toggleCam = () => {
        toggleVideo();
        localStorage.setItem('isCamOn',!isCamOn);
        setIsCamOn(!isCamOn);
    };


   
    // Memoize Map component to prevent re-renders
    const memoizedMap = useMemo(() => <Map isMicOn={isMicOn} isCamOn={isCamOn}/>, []);

    return (
        <div className="video-call-container">
            <div className="video-frame">
                {memoizedMap}
            </div>

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
