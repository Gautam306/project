import React, { createContext, useMemo, useContext, useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [remoteStream, setRemoteStream] = useState(null);
  const [myStream, setMyStream] = useState(null);

  const socket = useRef(null);
  
  

  return (
    <SocketContext.Provider value={{ socket, remoteStream, setRemoteStream, myStream, setMyStream }}>
      {children}
    </SocketContext.Provider>
  );
};
