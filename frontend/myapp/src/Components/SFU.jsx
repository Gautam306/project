import React, { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import ReactPlayer from "react-player";
import { useSocket } from "../ContextApi/SocketProvider";
import DraggableDiv from "./DraggableDiv";


// const socket = io("http://localhost:5000");

const App = ({ roomId, isMicOn, isCamOn }) => {
  console.log("roomId ", roomId);
  const { socket, audioMic, videoCallMic, producersRef, streamRef, } = useSocket();
  // const audioMic=useRef(null), videoCallMic=useRef(null);
  // const [roomId, setRoomId] = useState("10");
  const [joined, setJoined] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [peers, setPeers] = useState([]);
  const [error, setError] = useState(null);
  const [localStream, setlocalStream] = useState(null);
  const localVideoRef = useRef(null);
  const deviceRef = useRef(null);
  const producerTransportRef = useRef(null);
  // const producersRef = useRef(new Map());
  const consumerTransportsRef = useRef(new Map());
  const consumersRef = useRef(new Map());
  const [videoControl, setVideoControl] = useState(true);
  // const streamRef = useRef(null);

  // const [audioMic, setAudioMic] = useState(false);
  // const [videoCallMic, setVideoCallMic] = useState(false);

  // console.log("localStream ",localStream);
  // useEffect(() => {
  //   console.log("sfu socket",socket);
  //   // socket.current = io('http://localhost:5001')
  //   // socket.current.emit("join-room", {roomId});
  //   return () => {
  //     if (socket.current) {
  //       socket.current.disconnect();
  //     }
  //   }
  // }, [])

  useEffect(() => {
    console.log("useeffect call");
    socket?.current?.off("router-rtp-capabilities");
    socket?.current?.off("transport-created-send");
    socket?.current?.off("new-producer");
    socket?.current?.off("producer-list");
    socket?.current?.off("peers-in-room");
    socket?.current?.off("peer-joined");
    socket?.current?.off("peer-left");
    socket?.current?.off("consumer-created");
    socket?.current?.off("connect-transport");
    socket?.current?.off('existing-producers');



    socket.current?.on("video-pause", (roomID) => {
      console.log("receive video-pause notification");
      setVideoControl(!videoControl);
    });


    socket?.current?.on("peers-in-room", (peerList) => {
      console.log("Existing peers in room:", peerList);
      setPeers(peerList);
    });

    socket?.current?.on("peer-joined", ({ peerId, peerDetails }) => {
      console.log("New peer joined:", peerDetails);
      setPeers(prev => [...prev, peerDetails]);
    });

    socket?.current?.on("peer-left", ({ peerId }) => {
      console.log("Peer left:", peerId);
      setPeers(prev => prev.filter(p => p.id !== peerId));

      // Clean up consumer transport and stream
      const consumerTransport = consumerTransportsRef.current.get(peerId);
      if (consumerTransport) {
        consumerTransport.close();
        consumerTransportsRef.current.delete(peerId);
      }

      const consumer = consumersRef.current.get(peerId);
      if (consumer) {
        consumer.close();
        consumersRef.current.delete(peerId);
      }

      setRemoteStreams(prev => {
        const updated = { ...prev };
        delete updated[peerId];
        return updated;
      });
    });

    socket?.current?.on("router-rtp-capabilities", async (rtpCapabilities) => {
      try {
        deviceRef.current = new mediasoupClient.Device();
        await deviceRef.current.load({ routerRtpCapabilities: rtpCapabilities });
        console.log("✅ Device loaded with RTP Capabilitiescreate-transport direction send");
        socket?.current?.emit("create-transport", { direction: "send", roomId: roomId });
        setJoined(true);
      } catch (err) {
        console.error("Failed to load device:", err);
        setError("Failed to initialize media device");
      }
    });

    socket?.current?.on("transport-created-send", async ({ id, iceParameters, iceCandidates, dtlsParameters }) => {
      try {
        producerTransportRef.current = deviceRef.current.createSendTransport({
          id,
          iceParameters,
          iceCandidates,
          dtlsParameters,
          enableSctp: true // Enable data channel
        });

        producerTransportRef.current.on("connect", async ({ dtlsParameters }, callback, errback) => {
          try {
            console.log("producer Transport");
            socket?.current?.emit("connect-transport", { transportId: id, dtlsParameters, roomId: roomId });
            callback();
          } catch (error) {
            errback(error);
          }
        });

        producerTransportRef.current.on("produce", async ({ kind, rtpParameters }, callback, errback) => {
          try {
            socket?.current?.emit("produce", { transportId: id, kind, rtpParameters, roomId: roomId });
            socket?.current?.once("producer-created", ({ id }) => callback({ id }));
          } catch (error) {
            errback(error);
          }
        });

        await startMedia();
      } catch (err) {
        console.error("Failed to create send transport:", err);
        setError("Failed to create media transport");
      }
    });

    socket?.current?.on("producer-list", async (producers) => {
      console.log("Existing producers:", producers);
      for (const { producerId, producerPeerId } of producers) {
        await createConsumerTransport(producerId, producerPeerId);
      }
    });

    socket?.current?.on("existing-producers", async (producers) => {
      console.log("⚡ Received existing producers:", producers);

      // Process producers sequentially
      for (const { producerId, producerPeerId } of producers) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Add delay between each consumer
        await createConsumerTransport(producerId, producerPeerId);
      }
    });

    socket?.current?.on("consumer-resumed", ({ consumerId }) => {
      console.log("Consumer resumed:", consumerId);
    });

    socket?.current?.on("new-producer", async ({ producerId, producerPeerId }) => {
      console.log("New producer:", producerId, "from peer:", producerPeerId);
      await createConsumerTransport(producerId, producerPeerId);
    });

    socket?.current?.on("consumer-created", async ({ id, producerId, kind, rtpParameters, producerPeerId }) => {
      console.log("Creating consumer:", { id, producerId, kind, producerPeerId });

      const consumerTransport = consumerTransportsRef.current.get(producerPeerId);
      if (!consumerTransport) {
        console.error("No consumer transport found for peer:", producerPeerId);
        return;
      }

      try {
        // Check if we already have a consumer for this peer
        if (consumersRef.current.has(producerPeerId)) {
          console.log("Consumer already exists for peer:", producerPeerId);
          return;
        }

        const consumer = await consumerTransport.consume({
          id,
          producerId,
          kind,
          rtpParameters,
        });

        consumersRef.current.set(producerPeerId, consumer);

        const newStream = new MediaStream();
        newStream.addTrack(consumer.track);

        console.log("Setting remote stream for peer:", producerPeerId);
        setRemoteStreams(prev => ({
          ...prev,
          [producerPeerId]: newStream
        }));

        socket?.current?.emit("resume-consumer", { consumerId: consumer.id, roomId: roomId });
        await consumer.resume();
      } catch (error) {
        console.error("Error consuming media:", error);
        setError(`Failed to consume media: ${error.message}`);
      }
    });

    return () => {
      // Cleanup
      console.log("🧹 Cleaning up socket?.current? listeners");
      socket?.current?.off("router-rtp-capabilities");
      socket?.current?.off("transport-created-send");
      socket?.current?.off("new-producer");
      socket?.current?.off("producer-list");
      socket?.current?.off("peers-in-room");
      socket?.current?.off("peer-joined");
      socket?.current?.off("peer-left");
      socket?.current?.off("consumer-created");
      socket?.current?.off("connect-transport");
      socket?.current?.off("existing-producers");

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Close producer transport
      if (producerTransportRef.current) {
        producerTransportRef.current.close();
      }

      // Close all consumer transports
      consumerTransportsRef.current.forEach(transport => transport.close());
      consumersRef.current.forEach(consumer => consumer.close());
    };
  }, [roomId]);




  useEffect(() => {
    socket.current?.on("video:pause", ({ roomID }) => {
      console.log("video:paused ", roomID);
      setVideoControl(prev => !prev);
    });

    return () => {
      socket.current?.off("video:pause");

    };
  }, [socket.current]);

  const createConsumerTransport = async (producerId, producerPeerId) => {
    try {
      console.log("Creating consumer transport for producer:", producerId, "peer:", producerPeerId);

      // Check if we already have a consumer transport for this peer
      if (consumerTransportsRef.current.has(producerPeerId)) {
        console.log("Consumer transport already exists for peer:", producerPeerId);
        return;
      }
      console.log("✅ Device loaded create- recv");
      socket?.current?.emit("create-transport", { direction: "recv", roomId: roomId });

      return new Promise((resolve) => {
        socket?.current?.once("transport-created-recv", async ({ id, iceParameters, iceCandidates, dtlsParameters }) => {
          try {
            const consumerTransport = deviceRef.current.createRecvTransport({
              id,
              iceParameters,
              iceCandidates,
              dtlsParameters,
              enableSctp: true
            });

            consumerTransportsRef.current.set(producerPeerId, consumerTransport);

            consumerTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
              socket?.current?.emit("connect-transport", {
                transportId: id,
                dtlsParameters,
                roomId: roomId
              });
              callback();
            });

            await new Promise(resolve => setTimeout(resolve, 500)); // Allow transport to settle

            if (deviceRef.current.rtpCapabilities) {
              socket?.current?.emit("consume", {
                consumerTransportId: id,
                producerId,
                rtpCapabilities: deviceRef.current.rtpCapabilities,
                roomId: roomId,
                producerPeerId
              });
            }

            resolve();
          } catch (error) {
            console.error("Error in transport creation:", error);
            resolve(); // Resolve anyway to continue with other producers
          }
        });
      });
    } catch (err) {
      console.error("Failed to create consumer transport:", err);
      setError("Failed to create consumer transport");
    }
  };

  const startMedia = async () => {
    try {
      console.log("startMedia call");
      // Check if transport is closed before proceeding
      if (!producerTransportRef.current || producerTransportRef.current.closed) {
        console.error("Producer transport is closed or not initialized");
        return;
      }
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { max: 30 }
        },
        audio: true
      });
      console.log("startMedia call localVideRef set before", localVideoRef.current);
      setlocalStream(streamRef.current);

      if (localVideoRef.current) {
        console.log("startMedia call localVideRef set", streamRef.current);
        localVideoRef.current.srcObject = streamRef.current;
      }

      if (!producerTransportRef.current) {
        console.error("Producer transport is not initialized.");
      } else if (producerTransportRef.current.closed) {
        console.error("Producer transport is closed.");
        stopMedia();
      } else {
        console.log("Producer transport is active.");
      

      // Produce video track
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        // console.log("isCamOn ",localStorage.getItem('isCamOn'));


        console.log("Producing video track:", videoTrack.label);
        const videoProducer = await producerTransportRef.current.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 500000, scaleResolutionDownBy: 2 },  // Medium-high quality
            { maxBitrate: 1200000, scaleResolutionDownBy: 1.5 },  // High quality
            { maxBitrate: 2500000 }  // Very high quality
          ]
          ,
          codecOptions: {
            videoGoogleStartBitrate: 3000
          }
        });
        producersRef.current.set('video', videoProducer);


      }

      // Produce audio track
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {

        console.log("Producing audio track:", audioTrack.label);
        const audioProducer = await producerTransportRef.current.produce({
          track: audioTrack,
          codecOptions: {
            opusStereo: true,
            opusDtx: true
          }
        });
        producersRef.current.set('audio', audioProducer);
      }
    }
      // const isCamOn = localStorage.getItem('isCamOn') === "true";
      // const isMicOn = localStorage.getItem('isMicOn') === "true";


      // if (streamRef.current && !isCamOn) {
      //   const videoTrack = streamRef.current.getVideoTracks()[0];
      //   if (videoTrack) {
      //     videoTrack.enabled = isCamOn;
      //     // setIsVideoEnabled(videoTrack.enabled);

      //     // If we have a video producer, pause/resume it
      //     const videoProducer = producersRef.current.get('video');
      //     if (videoProducer) {
      //       if (videoTrack.enabled) {
      //         await videoProducer.resume();
      //       } else {
      //         await videoProducer.pause();
      //       }
      //       // setVideoControl(!videoControl);
      //       // socket.current?.emit("video-pause", {roomID:localStorage.getItem('roomID')});
      //     }
      //   }
      // }

      // if (streamRef.current) {
      //   const audioTrack = streamRef.current.getAudioTracks()[0];
      //   if (audioTrack) {
      //     audioTrack.enabled = isMicOn;
      //     // setIsAudioEnabled(audioTrack.enabled);

      //     // If we have an audio producer, pause/resume it
      //     const audioProducer = producersRef.current.get('audio');
      //     if (audioProducer) {
      //       if (audioTrack.enabled) {
      //         await audioProducer.resume();
      //       } else {
      //         await audioProducer.pause();
      //       }
      //     }
      //   }
      // }


    } catch (err) {
      console.error("Failed to start media:", err);
      setError("Failed to access camera/microphone");
    }
  };

  const stopMedia = async () => {
    try {
      console.log("stopMedia call");

      // Stop video and audio tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Stop and close video producer
      const videoProducer = producersRef.current.get('video');
      if (videoProducer) {
        console.log("Closing video producer");
        await videoProducer.close();
        producersRef.current.delete('video');
      }

      // Stop and close audio producer
      const audioProducer = producersRef.current.get('audio');
      if (audioProducer) {
        console.log("Closing audio producer");
        await audioProducer.close();
        producersRef.current.delete('audio');
      }

      // Clear video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      console.log("Media stopped successfully");

    } catch (err) {
      console.error("Failed to stop media:", err);
    }
  };


  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  const toggleVideo = async () => {
    try {
      if (streamRef.current) {
        const videoTrack = streamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !videoTrack.enabled;
          setIsVideoEnabled(videoTrack.enabled);

          // If we have a video producer, pause/resume it
          const videoProducer = producersRef.current.get('video');
          if (videoProducer) {
            if (videoTrack.enabled) {
              await videoProducer.resume();
            } else {
              await videoProducer.pause();
            }
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


  useEffect(() => {

    toggleAudio();

  }, [audioMic.current, isCamOn]);

  useEffect(() => {
    console.log("videoCallMic ", videoCallMic);
    // toggleVideo();

  }, [videoCallMic.current, isMicOn])

  return (
    <div className="p-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {false ? (
        <div className="flex flex-col items-center gap-4">
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            // onChange={(e) => setRoomId(e.target.value)}
            className="p-2 border rounded"
          />
          <button
            onClick={() => socket?.current?.emit("join-room", { roomId })}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Join Room
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {/* <h2 className="text-xl mb-4">Room: {roomId}</h2> */}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="relative">
              {/* <h3 className="text-lg mb-2">My Video</h3> */}
              {localStream && <DraggableDiv key={localStream.id} Stream={localStream} isCamOn={true} stopMedia={stopMedia} user="yours" />}

            </div>

            {Object.entries(remoteStreams).map(([peerId, stream]) => (
              console.log("remoteStreams ", peerId, " ", stream) ||
              <DraggableDiv key={peerId} Stream={stream} isCamOn={true} stopMedia={stopMedia} user="other" />

            ))}
          </div>
          {/* <div className="flex gap-4">
            <button
              onClick={toggleVideo}
              className={`px-4 py-2 rounded-md ${isVideoEnabled ? 'bg-blue-500' : 'bg-red-500'
                } text-white`}
            >
              {isVideoEnabled ? 'Turn Off Video' : 'Turn On Video'}
            </button>

            <button
              onClick={toggleAudio}
              className={`px-4 py-2 rounded-md ${isAudioEnabled ? 'bg-blue-500' : 'bg-red-500'
                } text-white`}
            >
              {isAudioEnabled ? 'Turn Off Audio' : 'Turn On Audio'}
            </button>
          </div> */}
        </div>
      )}
    </div>
  );
};

export default App;