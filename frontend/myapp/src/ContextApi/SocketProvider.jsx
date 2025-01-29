import React, { createContext, useMemo, useContext, useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import peer from '../services/peer';

const SocketContext = createContext(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [remoteStream, setRemoteStream] = useState([]);
  const [myStream, setMyStream] = useState(null);
  const [remoteSocketId, setRemoteSocketId] = useState([]);

  const socket = useRef(null);

  const remoteSocketIdRef = useRef(null);
  const remoteSocketStreamIdRef = useRef(null);
  const myStreamIdRef = useRef(null);
  useEffect(()=>{
    myStreamIdRef.current=myStream;
  },[myStream])

  // Update the ref whenever `remoteSocketId` changes
  useEffect(() => {
    remoteSocketIdRef.current = remoteSocketId;
  }, [remoteSocketId]);
  useEffect(() => {
    remoteSocketStreamIdRef.current = remoteStream;
  }, [remoteStream]);
  console.log("remoteSocketid", remoteSocketIdRef.current);



  const handleCallDisconnect = async (id) => {
    console.log(`User with socket ID ${id} left the chat.`, remoteSocketIdRef.current);
    console.log("remoteSocketid inside", remoteSocketIdRef.current, " ", remoteSocketStreamIdRef.current);

    if (id === remoteSocketIdRef.current) {


      if (remoteSocketStreamIdRef.current) {
        console.log("handleCallDisconnect ", id, "  ", remoteSocketStreamIdRef.current);
        

        const existingSenders = peer.peer.getSenders();
        existingSenders.forEach((sender) => {
          console.log("sender track", sender, "   ", myStreamIdRef);
          if (sender.track!=myStreamIdRef) {
            sender.track?.stop(); // Stop the track if necessary
            peer.peer.removeTrack(sender); // Remove the sender
            console.log(`Removed track: ${sender.track?.kind}`);
          }
        });

        if (remoteSocketStreamIdRef.current) {
          remoteSocketStreamIdRef.current.forEach((item) => {
            item.getTracks().forEach((track) => {
              track.stop(); // Stops each track
            });
          });
        }
        
        console.log("remoteSocketStreamIdRef.current ",remoteSocketStreamIdRef.current);

      }

      // Clear remote socket ID and stream
      setRemoteSocketId(null);
      setRemoteStream([]);
      setMyStream(null);
      // remoteSocketStreamIdRef.current=null;
    }
  };




  return (
    <SocketContext.Provider value={{ socket, remoteStream, setRemoteStream, myStream, setMyStream, handleCallDisconnect, remoteSocketId, setRemoteSocketId }}>
      {children}
    </SocketContext.Provider>
  );
};
