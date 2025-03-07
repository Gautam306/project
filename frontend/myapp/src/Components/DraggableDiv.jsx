import React, { useEffect, useState } from "react";
import ReactPlayer from "react-player";
import { CameraOff } from "react-feather";
import { useSocket } from "../ContextApi/SocketProvider";



const DraggableDiv = ({ Stream, isCamOn, user }) => {

  const screenWidth = window.innerWidth;
  const screeenHeight = window.innerHeight;
  const {producersRef,streamRef,socket } = useSocket();
  console.log("STREAM ", Stream,"   ",user,"  ",Stream?.getVideoTracks()[0]);

  

  const [position, setPosition] = useState({
    x: Math.random() * 100,
    y: Math.random() * 50
  });

  useEffect(() => {

    if (user === "yours") {
      console.log("yours");
      // setPosition({x:screenWidth/2,y:screeenHeight/2}) 
    }
  }, [user])

  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // console.log(Stream);
  const handleMouseDown = (e) => {
    setDragging(true);
    setOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e) => {
    if (dragging) {
      setPosition({
        x: e.clientX - offset.x,
        y: e.clientY - offset.y,
      });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
  };



  return (
    <div
      // key={videoControl}
      className="video"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: dragging ? "grabbing" : "grab",
        position: user == "yours" ? 'fixed' : 'absolute',
        left: user == "yours" && 0,
        bottom: user == "yours" && 0,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {user}
      {Stream ? <ReactPlayer key={Date.now()} playing={Stream.getVideoTracks()[0]?.enabled} height="100%" width='100%' url={Stream} muted={!Stream.getAudioTracks()[0]?.enabled} /> : <CameraOff />}
    </div>
  );
};

export default DraggableDiv;
