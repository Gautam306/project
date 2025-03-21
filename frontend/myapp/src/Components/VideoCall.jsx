import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import peer from "../services/peer";
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash } from "react-icons/fa";
// import "./RoomPage.css";
import { useSocket } from "../ContextApi/SocketProvider";
// import Chat from '../screens/Chat';

const RoomPage = () => {
  const { socket, remoteStream, setRemoteStream, myStream, setMyStream, remoteSocketId, setRemoteSocketId, handleCallDisconnect } = useSocket();

  // const [remoteSocketId, setRemoteSocketId] = useState(null);
  // const [myStream, setMyStream] = useState(null);
  // const [remoteStream, setRemoteStream] = useState();
  // const [sendStreamsStatus, setSendStreamsStatus] = useState(false);
  console.log("Video Call components ", socket.current?.id);
  

  const handleUserJoined = useCallback(async ({ email, id }) => {
    console.log(`Email ${email} joined room`, id);
    setRemoteSocketId(id);
    handleCallUser(id);
  }, [myStream]);

  const handleAllUser = async ({ data }) => {
    console.log("handleALlUser", data.length);
    // const tempData=JSON.parse(data);
    // Loop through the keys of the Map
    for (let i = data.length - 2; i < data.length; i++) {
      console.log("handleALlUser data ", data[i]);
      if (data[i]!==undefined && data[i] != socket.current?.id) {
        setRemoteSocketId(data[i]);
        console.log("find RemoteSocketId ", data[i]);
        (data[i]);
      }
      // console.log(data[i]);
    }

  };

  const EnterRoom = async () => {

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    console.log("enterRoom", stream);

    // localStorage.setItem("stream",stream);
    if (myStream === null)
      setMyStream(stream);
  }
  useEffect(() => {
    console.log("myStream useEffect ", myStream);
    if (myStream === null)
    EnterRoom();
  }, [myStream])



  const handleCallUser = useCallback(async (id) => {

    console.log("handleCalluser");
    // sendStreams(stream);
    const offer = await peer.getOffer();
    socket.current?.emit("user:call", { to: id, offer });
  }, [remoteSocketId, socket.current]);

  const handleIncommingCall = 
    async ({ from, offer }) => {

      console.log("handleIncommingCall");
      setRemoteSocketId(from);
      // const stream = await navigator.mediaDevices.getUserMedia({
      //   audio: true,
      //   video: true,
      // });
      // setMyStream(stream);

      // sendStreams(stream);
      console.log(`Incoming Call`, from, offer);
      const ans = await peer.getAnswer(offer);
      socket.current?.emit("call:accepted", { to: from, ans });
      // if(myStream!==null)
      //   setMyStream(stream);
    };

  const sendStreams = useCallback(async () => {
    console.log("sendStreams", myStream);
    // const tempStream=myStream!==null ?myStream:JSON.parse(localStorage.getItem("stream"));
    if (myStream === null) {
      return;
    }

    // Get existing senders
    const existingSenders = peer.peer.getSenders();
    existingSenders.forEach((sender) => {
      console.log("sender track", sender, "   ", myStream)
      if (sender.track != myStream) {
        // sender.track?.stop(); // Stop the track if necessary
        // peer.peer.removeTrack(sender); // Remove the sender
        console.log(`Removed track: ${sender.track}`,"  ",myStream);
      }
    });
    for (const track of myStream.getTracks()) {
      // Check if the track is already added
      const trackAlreadyAdded = existingSenders.some((sender) => sender.track === track);
      // !trackAlreadyAdded
      // const existingSenders = peer.peer.getSenders();

      // Remove all existing tracks before re-adding


      if (!trackAlreadyAdded) {
        peer.peer.addTrack(track, myStream);
        console.log(`Track added: ${track.kind}`);
      } else {
        console.log(`Track already added: ${track.kind}`);
      }
    }
  }, [myStream]);

  useEffect(() => {
    sendStreams();
  }, [myStream])


  const handleCallAccepted = useCallback(
    ({ from, ans }) => {

      peer.setLocalDescription(ans);
      console.log("Call Accepted!");
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    if(socket.current==null)
        return;
    const offer = await peer.getOffer();
    console.log("handleNegoNeeded");
    socket.current?.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      if(socket.current==null)
          return;
      console.log("handleNegoNeedIncomming");
      const ans = await peer.getAnswer(offer);
      socket.current?.emit("peer:nego:done", { to: from, ans });
      sendStreams();
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    console.log("handleNegoNeedFinal");
    await peer.setLocalDescription(ans);

  }, [sendStreams]);

  const addRemoteStream = (newStream) => {
    // Check if the stream is already present in the array
    console.log("addRemoteStream 1",remoteStream);
    const isStreamPresent = remoteStream.some(
      (stream) => {stream.id === newStream.id || console.log(stream.id," addRemoteStream   ",newStream.id)}
    );
    console.log("addRemoteStream 2",isStreamPresent);
    if (!isStreamPresent) {
      // Add the new stream if it's not already in the array
      
      setRemoteStream([...remoteStream,newStream]); // Update the state with a new array reference
    }
  };
  
  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams;
      console.log("GOT TRACKS!!");
      // setRemoteStream(remoteStream[0]);
      addRemoteStream(remoteStream[0]);
      
    });
  }, []);

  // const handleCallDisconnect = useCallback(async ({ id }) => {
  //   console.log(`User with socket ID ${id} left the chat.`);
  //   if (id === remoteSocketId) {
  //     // Stop all tracks of the remote stream
  //     if (remoteStream) {
  //       remoteStream.getTracks().forEach((track) => track.stop());
  //     }
  //     // Clear remote socket ID and stream
  //     setRemoteSocketId(null);
  //     setRemoteStream(null);
  //   }

  // }, [remoteSocketId, remoteStream, socket])


  useEffect(() => {
    console.log("heelo useeffect", socket.current?.id);
    socket.current?.on("all:user", handleAllUser);
    // socket.current?.on("room:join",handleAllUser);
    socket.current?.on("user:joined", handleUserJoined);
    // socket.current?.on("user:joined", handleAllUser);
    socket.current?.on("incomming:call", handleIncommingCall);
    socket.current?.on("call:accepted", handleCallAccepted);
    socket.current?.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.current?.on("peer:nego:final", handleNegoNeedFinal);
    socket.current?.on("user:left", handleCallDisconnect);

    return () => {
      socket.current?.off("all:user", handleAllUser);
      socket.current?.off("user:joined", handleUserJoined);
      // socket.current?.off("user:joined", handleAllUser);
      socket.current?.off("incomming:call", handleIncommingCall);
      socket.current?.off("call:accepted", handleCallAccepted);
      socket.current?.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.current?.off("peer:nego:final", handleNegoNeedFinal);
      socket.current?.off("user:left", handleCallDisconnect);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
    handleCallDisconnect
  ]);


  return (
    <>
    </>
   

  );
};

export default RoomPage;