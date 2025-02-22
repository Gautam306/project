import React, { createContext, useMemo, useContext, useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import peer from '../services/peer';

const SocketContext = createContext(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [remoteStream, setRemoteStream] = useState([]);
  const [myStream, setMyStream] = useState();
  const [remoteSocketId, setRemoteSocketId] = useState([]);
  const [localStream,setlocalStream]=useState(null);
  // const[audioMic,setAudioMic]=useState(false);
  // const [videoCallMic,setVideoCallMic]=useState(false);

  const socket = useRef(null);
  const audioMic = useRef(null);
  const videoCallMic = useRef(null);
  const producersRef = useRef(new Map());
  const streamRef = useRef(null);

  const remoteSocketIdRef = useRef(null);
  const remoteSocketStreamIdRef = useRef(null);
  const myStreamIdRef = useRef(null);

  
  const [isVideoOn, setIsVideoCall] = useState(true);
  



  return (
    <SocketContext.Provider value={{producersRef,streamRef,isVideoOn, setIsVideoCall, audioMic,videoCallMic,socket, remoteStream,myStreamIdRef, setRemoteStream, myStream, setMyStream, remoteSocketId, setRemoteSocketId,localStream,setlocalStream }}>
      {children}
    </SocketContext.Provider>
  );
};
