import React, { useState } from "react";
import ReactPlayer from "react-player";
import {CameraOff} from "react-feather";

const DraggableDiv = ({Stream,isCamOn,user}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
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
      className="video"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: dragging ? "grabbing" : "grab",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp} // Stop dragging if the mouse leaves the div
    >
      {user}
      {Stream && Stream?.getVideoTracks()?.[0]?.enabled?<ReactPlayer playing muted height="90%" width='90%'  url={Stream} />:<CameraOff/>}
    </div>
  );
};

export default DraggableDiv;
