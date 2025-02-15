// SERVER (server.js)
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mediasoup = require("mediasoup");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

let workers = [];
let rooms = {};
let peers = {};

const createWorkers = async () => {
    for (let i = 0; i < 2; i++) {
        let worker = await mediasoup.createWorker({
            logLevel: "debug",
            rtcMinPort: 20000,
            rtcMaxPort: 40000,
        });
        worker.on("died", () => {
            console.error("Mediasoup Worker died, exiting...");
            process.exit(1);
        });
        workers.push(worker);
    }
};

const getOrCreateRoom = async (roomId) => {
    if (rooms[roomId]) return rooms[roomId];

    const worker = workers[Math.floor(Math.random() * workers.length)];
    const router = await worker.createRouter({
        mediaCodecs: [
            {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2
            },
            {
                kind: 'video',
                mimeType: 'video/VP8',
                clockRate: 90000,
                parameters: {
                    'x-google-start-bitrate': 1000
                }
            }
        ]
    });

    rooms[roomId] = {
        router,
        peers: new Map(),
        transports: [],
        producers: [],
        consumers: []
    };
    return rooms[roomId];
};

const createWebRtcTransport = async (router) => {
    return await router.createWebRtcTransport({
        listenIps: [{ ip: "0.0.0.0", announcedIp: "127.0.0.1" }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,

        initialAvailableOutgoingBitrate: 1000000
    });
};


const disconnectAllUsers = () => {
    try {
        for (const roomId in rooms) {
            const room = rooms[roomId];

            // Disconnect all peers in the room
            for (const [peerId, peer] of room.peers.entries()) {
                // Close all producers
                peer.producers.forEach(producer => producer.close());

                // Close all consumers
                peer.consumers.forEach(consumer => consumer.close());

                // Close all transports
                peer.transports.forEach(transport => transport.close());

                // Notify peer about disconnection
                peer.socket.emit("force-disconnect");

                // Disconnect socket
                peer.socket.disconnect(true);
            }

            // Clear room data
            delete rooms[roomId];
        }

        console.log("All users disconnected successfully.");
    } catch (error) {
        console.error("Error disconnecting all users:", error);
    }
};

// disconnectAllUsers();
io.on("connection", async (socket) => {
    console.log("Client connected:", socket.id);

    // 2. Update the join-room handler to properly handle producer list
    socket.on("join-room", async ({ roomId }) => {
        try {
            console.log("join-room: ",roomId);
            const room = await getOrCreateRoom(roomId);
            socket.roomId = roomId;

            // Add peer to room
            room.peers.set(socket.id, {
                socket,
                transports: [],
                producers: [],
                consumers: [],
                peerDetails: {
                    name: `Peer ${Math.random().toString(36).substring(7)}`,
                    id: socket.id,
                }
            });

            socket.join(roomId);

            // Notify client about router capabilities
            socket.emit("router-rtp-capabilities", room.router.rtpCapabilities);

            // Get list of all other peers
            const otherPeers = Array.from(room.peers.values())
                .filter(peer => peer.peerDetails.id !== socket.id)
                .map(peer => peer.peerDetails);

            // Send existing peers to new peer
            socket.emit("peers-in-room", otherPeers);

            // Notify other peers about new peer
            socket.broadcast.to(roomId).emit("peer-joined", {
                peerId: socket.id,
                peerDetails: room.peers.get(socket.id).peerDetails
            });

            const existingProducers = room.producers.map(producer => ({
                producerId: producer.id,
                producerPeerId: producer.appData.peerId,
                kind: producer.kind
            }));

            // Emit existing producers after a short delay to ensure proper initialization
            setTimeout(() => {
                socket.emit("existing-producers", existingProducers);
            }, 1000);


            // Get all existing producers with their peer IDs
            const producerList = room.producers.map(producer => ({
                producerId: producer.id,
                producerPeerId: producer.appData.peerId,
                kind: producer.kind,
                rtpParameters: producer.rtpParameters
            }));

            // console.log(`Sending producer list to new user ${socket.id}:`, producerList);
            socket.emit("producer-list", producerList);

        } catch (error) {
            console.error("Error joining room:", error);
            socket.emit("error", { message: "Error joining room" });
        }
    });

    socket.on("create-transport", async ({ direction, roomId }) => {
        try {
            console.log(`⚡ Creating transport for ${socket.id}, direction: ${direction}, roomID: ${roomId}`);
            const room = rooms[roomId];
            if (!room) throw new Error("Room not found");

            const transport = await createWebRtcTransport(room.router);
            room.transports.push(transport);

            // Store transport information for the peer
            const peer = room.peers.get(socket.id);
            if (peer) {
                peer.transports.push(transport);
            }

            transport.on("dtlsstatechange", (dtlsState) => {
                if (dtlsState === "closed") {
                    transport.close();
                }
            });
            console.log(`✅ Transport created: ${transport.id} for socket ${socket.id}`);
            socket.emit(`transport-created-${direction}`, {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });

        } catch (error) {
            console.error("Error creating transport:", error);
            socket.emit("error", { message: "Error creating transport" });
        }
    });

    socket.on("connect-transport", async ({ transportId, dtlsParameters, roomId }) => {
        try {
            const room = rooms[roomId];
            if (!room) throw new Error("Room not found");

            const transport = room.transports.find(t => t.id === transportId);
            if (!transport) throw new Error("Transport not found");

            // ✅ Prevent multiple connection attempts
            console.log("transport.dtlsState", transport.dtlsState);
            if (transport.dtlsState === "connected") {
                console.log(`⚠️ Transport ${transportId} already connected, sharing existing stream.`);

                // Send existing producer list to requester
                const existingProducers = room.producers.map(p => ({
                    producerId: p.id,
                    producerPeerId: p.peerId
                }));

                socket.emit("existing-producers", existingProducers);
                return;
            }

            await transport.connect({ dtlsParameters });
            // ✅ Attach dtlsstatechange listener
            transport.on("dtlsstatechange", (state) => {
                console.log(`🔄 Transport ${transportId} dtlsState changed to:`, state);
                if (state === "connected") {
                    console.log(`✅ Transport ${transportId} is now fully connected.`);
                    transport.dtlsState = "connected"; // ✅ Mark as connected
                }
            });
            transport.dtlsState = "connected";  // Mark transport as connected


            console.log(`✅ Transport ${transportId} connected successfully `, transport.dtlsState);
            socket.emit("transport-connected", { transportId });

        } catch (error) {
            console.error("❌ Error connecting transport:", error);
            socket.emit("error", { message: "Error connecting transport", details: error.message });
        }
    });



    socket.on("produce", async ({ transportId, kind, rtpParameters, roomId }) => {
        try {
            const room = rooms[roomId];
            if (!room) throw new Error("Room not found");

            const transport = room.transports.find(t => t.id === transportId);
            if (!transport) throw new Error("Transport not found");

            const producer = await transport.produce({
                kind,
                rtpParameters,
                appData: { peerId: socket.id, mediaType: kind }
            });

            room.producers.push(producer);

            const peer = room.peers.get(socket.id);
            if (peer) {
                peer.producers.push(producer);
            }

            // Notify the producer
            socket.emit("producer-created", {
                id: producer.id, kind: producer.kind,
                rtpParameters: producer.rtpParameters
            });

            // Notify all other peers in the room
            socket.broadcast.to(roomId).emit("new-producer", {
                producerId: producer.id,
                producerPeerId: socket.id,
                kind: producer.kind,
                rtpParameters: producer.rtpParameters
            });

        } catch (error) {
            console.error("Error producing:", error);
            socket.emit("error", { message: "Error producing" });
        }
    });

    socket.on("consume", async ({ consumerTransportId, producerId, rtpCapabilities, roomId, producerPeerId }) => {
        try {
            const room = rooms[roomId];
            if (!room) throw new Error("Room not found");

            // console.log(`Available producers in room ${roomId}:`, room.producers.map(p => p.id));

            const transport = room.transports.find(t => t.id === consumerTransportId);
            if (!transport) throw new Error("Transport not found");

            const producer = room.producers.find(p => p.id === producerId);
            // console.log('Producer RTP Capabilities:', producer.rtpCapabilities);
            // console.log('Consumer RTP Capabilities:', rtpCapabilities);

            if (!producer) {
                console.error(`Producer ${producerId} not found in room ${roomId}`);
                throw new Error("Producer not found");
            }

            if (!room.router.canConsume({ producerId: producer.id, rtpCapabilities })) {
                console.error("Router cannot consume this producer:", producer.id);
                throw new Error("Cannot consume");
            }

            const consumer = await transport.consume({
                producerId: producer.id,
                rtpCapabilities,
                paused: false,
                appData: { peerId: socket.id, producerPeerId, mediaType: producer.kind }
            });

            room.consumers.push(consumer);

            const peer = room.peers.get(socket.id);
            if (peer) {
                peer.consumers.push(consumer);
            }

            socket.emit("consumer-created", {
                id: consumer.id,
                producerId: producer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                producerPeerId,
                type: producer.appData.mediaType
            });

            setTimeout(async () => {
                await consumer.resume();
                socket.emit("consumer-resumed", { consumerId: consumer.id });
            }, 1000);

        } catch (error) {
            console.error("Error consuming:", error);
            socket.emit("error", { message: error.message });
        }
    });


    socket.on("disconnect", () => {
        try {
            const roomId = socket.roomId;
            if (!roomId || !rooms[roomId]) return;

            const room = rooms[roomId];
            const peer = room.peers.get(socket.id);

            if (peer) {
                // Close all producers
                peer.producers.forEach(producer => producer.close());

                // Close all consumers
                peer.consumers.forEach(consumer => consumer.close());

                // Close all transports
                peer.transports.forEach(transport => transport.close());

                // Remove peer from room
                room.peers.delete(socket.id);

                // Notify other peers about disconnection
                socket.broadcast.to(roomId).emit("peer-left", { peerId: socket.id });
            }

            // If room is empty, close it
            if (room.peers.size === 0) {
                delete rooms[roomId];
            }

        } catch (error) {
            console.error("Error handling disconnect:", error);
        }
    });
});

createWorkers();
server.listen(5001, () => console.log("Server running on port 5001"));