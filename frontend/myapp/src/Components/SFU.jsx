import React, { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import ReactPlayer from "react-player";
import { useSocket } from "../ContextApi/SocketProvider";
import DraggableDiv from "./DraggableDiv";

// const socket = io("http://localhost:5000");

const App = (roomId) => {
  console.log("roomId ",roomId.roomId);
  const { socket } = useSocket();

  // const [roomId, setRoomId] = useState("10");
  const [joined, setJoined] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [peers, setPeers] = useState([]);
  const [error, setError] = useState(null);
  const [localStream,setlocalStream]=useState(null);
  const localVideoRef = useRef(null);
  const deviceRef = useRef(null);
  const producerTransportRef = useRef(null);
  const producersRef = useRef(new Map());
  const consumerTransportsRef = useRef(new Map());
  const consumersRef = useRef(new Map());
  const streamRef = useRef(null);
  

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
        socket?.current?.emit("create-transport", { direction: "send", roomId:roomId.roomId });
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
            socket?.current?.emit("connect-transport", { transportId: id, dtlsParameters, roomId:roomId.roomId });
            callback();
          } catch (error) {
            errback(error);
          }
        });

        producerTransportRef.current.on("produce", async ({ kind, rtpParameters }, callback, errback) => {
          try {
            socket?.current?.emit("produce", { transportId: id, kind, rtpParameters, roomId:roomId.roomId });
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

        socket?.current?.emit("resume-consumer", { consumerId: consumer.id, roomId:roomId.roomId });
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

  const createConsumerTransport = async (producerId, producerPeerId) => {
    try {
      console.log("Creating consumer transport for producer:", producerId, "peer:", producerPeerId);

      // Check if we already have a consumer transport for this peer
      if (consumerTransportsRef.current.has(producerPeerId)) {
        console.log("Consumer transport already exists for peer:", producerPeerId);
        return;
      }
      console.log("✅ Device loaded create- recv");
      socket?.current?.emit("create-transport", { direction: "recv", roomId:roomId.roomId });

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
                roomId:roomId.roomId
              });
              callback();
            });

            await new Promise(resolve => setTimeout(resolve, 500)); // Allow transport to settle

            if (deviceRef.current.rtpCapabilities) {
              socket?.current?.emit("consume", {
                consumerTransportId: id,
                producerId,
                rtpCapabilities: deviceRef.current.rtpCapabilities,
                roomId:roomId.roomId,
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
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { max: 30 }
        },
        audio: true
      });
      console.log("startMedia call localVideRef set before",localVideoRef.current);
      setlocalStream(streamRef.current);
      if (localVideoRef.current) {
        console.log("startMedia call localVideRef set");
        localVideoRef.current.srcObject = streamRef.current;
      }

      // Produce video track
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
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
    } catch (err) {
      console.error("Failed to start media:", err);
      setError("Failed to access camera/microphone");
    }
  };

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
              <DraggableDiv Stream={localStream} isCamOn={true} user="yours" />
              {/* <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full border-2 border-blue-500 rounded"
              /> */}
            </div>

            {Object.entries(remoteStreams).map(([peerId, stream]) => (
              console.log("remoteStreams ", peerId, " ", stream) ||
              <DraggableDiv Stream={stream} isCamOn={true} user="other" />
              // <div key={peerId} className="relative">
              //   <h3 className="text-lg mb-2">
              //     {peers.find(p => p.id === peerId)?.name || `Peer ID ${peerId}`}
              //   </h3>
              //   <DraggableDiv Stream={stream} isCamOn={true} user="other"/>
              //   {/* <ReactPlayer playing muted height="90%" width='90%' url={stream} /> */}
              // </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;