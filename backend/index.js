const { Server } = require("socket.io");

const io = new Server(8002, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});


const activeUsers = {}; // Tracks users by socket ID
const UserCorrespondingRoom = {}; // Tracks users per room (mapId)
const proximityDistance = 200; // Example proximity distance for triggering video call
const videoRooms = {}; //

const calculateDistance = (x1, y1, x2, y2) => {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

io.on("connection", (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Handle a new user joining
    socket.on("new-user-add", (username, mapId) => {
        // Ensure the room exists in UserCorrespondingRoom
        if (!UserCorrespondingRoom[mapId]) {
            UserCorrespondingRoom[mapId] = [];
        }

        // Add the user to the room if they aren't already in the room
        if (!Object.values(activeUsers).some(user => user.username === username)) {
            activeUsers[socket.id] = {
                username: username,
                id: socket.id,
                mapId: mapId,
                x: 400, // Default position
                y: 3840 - 100,
                anim: "walk-up",
            };



            // Join the user to the specific room
            socket.join(mapId);
            UserCorrespondingRoom[mapId].push(activeUsers[socket.id]);

            console.log("User added:", username, "Map ID:", mapId, " ", UserCorrespondingRoom[mapId]);

            // Notify all users in the room of the current players
            io.to(mapId).emit("currentPlayers", UserCorrespondingRoom[mapId]);
        }

    });

    // Request active users in the same room
    socket.on("requestActiveUsers", (mapId) => {
        if (UserCorrespondingRoom[mapId]) {
            socket.emit("currentPlayers", UserCorrespondingRoom[mapId]);
        } else {
            socket.emit("currentPlayers", "gau"); // Return empty if room doesn't exist
        }
    });

    // Handle player movement
    socket.on("playerMove", (data) => {
        if (activeUsers[socket.id]) {
            const user = activeUsers[socket.id];
            user.x = data.x;
            user.y = data.y;
            user.anim = data.anim;

            // console.log(`Player moved: ${user.username} in Map ID: ${user.mapId}`);

            // Notify other players in the same room about the movement
            socket.to(user.mapId).emit("playerMoved", user);
        }
    });

    // handle player meet-up
    socket.on("player-meet", (mapId) => {
        console.log("player-meet ", mapId, "  ", socket.id);
        socket.to(mapId).emit("player-meet");
    })


    // Handle player disconnection
    socket.on("disconnect", () => {
        console.log(`Player disconnected: ${socket.id}`);

        const user = activeUsers[socket.id];
        if (user) {
            const { mapId } = user;

            // Remove the user from activeUsers
            delete activeUsers[socket.id];

            // Remove the user from the room
            if (UserCorrespondingRoom[mapId]) {
                UserCorrespondingRoom[mapId] = UserCorrespondingRoom[mapId].filter(
                    (player) => player.id !== socket.id
                );

                console.log("disconnect user ", UserCorrespondingRoom[mapId]);
                // Notify the room of the updated player list
                io.to(mapId).emit("currentPlayers", UserCorrespondingRoom[mapId]);
            }

            // Notify others in the room that the user left
            io.to(mapId).emit("user-left", socket.id);
        }
    });



    // Periodic proximity check
    setInterval(() => {
        Object.keys(UserCorrespondingRoom).forEach((mapId) => {
            const usersInRoom = UserCorrespondingRoom[mapId];

            for (let i = 0; i < usersInRoom.length; i++) {
                for (let j = i + 1; j < usersInRoom.length; j++) {
                    const user1 = usersInRoom[i];
                    const user2 = usersInRoom[j];

                    const distance = calculateDistance(user1.x, user1.y, user2.x, user2.y);
                    // console.log("distance ",distance);
                    if (distance < proximityDistance) {
                        // Check if either user is already in a video room
                        let existingRoomID = null;

                        for (const roomID in videoRooms) {
                            if (videoRooms[roomID].includes(user1.id) || videoRooms[roomID].includes(user2.id)) {
                                existingRoomID = roomID;
                                break;
                            }
                        }

                        if (existingRoomID) {
                            // Add both users to the existing room
                            if (!videoRooms[existingRoomID].includes(user1.id)) {
                                console.log("distance ",distance,"  ",i,"  -----  ",j);
                                videoRooms[existingRoomID].push(user1.id);
                                io.to(user1.id).emit("video-call-start", roomID=existingRoomID);
                                io.to(user2.id).emit("video-call-start", roomID=existingRoomID);
                            }
                            if (!videoRooms[existingRoomID].includes(user2.id)) {
                                console.log("distance ",distance,"  ",i,"    ",j);
                                videoRooms[existingRoomID].push(user2.id);
                                io.to(user2.id).emit("video-call-start", roomID=existingRoomID);
                                io.to(user1.id).emit("video-call-start", roomID=existingRoomID);
                            }
                        } else {
                            // Create a new room if no existing room is found
                            
                            const roomID = `${user1.id}-${user2.id}`;
                            videoRooms[roomID] = [user1.id, user2.id];
                            console.log("distance ",distance,"  ",user1.id,"  <><><.  ",user2.id,"        ",roomID);
                            io.to(user1.id).emit("video-call-start", roomID);
                            io.to(user2.id).emit("video-call-start", roomID);
                        }
                    } else {
                        // If users are far apart, remove them from any shared video room
                        let roomToRemove = null;

                        for (const roomID in videoRooms) {
                            if (videoRooms[roomID].includes(user1.id) && videoRooms[roomID].includes(user2.id)) {
                                roomToRemove = roomID;
                                break;
                            }
                        }

                        if (roomToRemove) {
                            console.log('video-call-end');
                            videoRooms[roomToRemove] = videoRooms[roomToRemove].filter(
                                (userID) => userID !== user1.id && userID !== user2.id
                            );

                            io.to(user1.id).emit("video-call-end", roomToRemove);
                            io.to(user2.id).emit("video-call-end", roomToRemove);

                            // If the room is now empty, delete it
                            if (videoRooms[roomToRemove].length === 0) {
                                delete videoRooms[roomToRemove];
                            }
                        }
                    }
                }
            }
        });
    }, 1000); // Run proximity check every second

});
