const { Server } = require("socket.io");

const io = new Server(8002, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});


const activeUsers = {}; // Tracks users by socket ID
const UserCorrespondingRoom = {}; // Tracks users per room (mapId)
const proximityDistance = 30; // Example proximity distance for triggering video call
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
            // add 
            usersInRoom.forEach((user) => {
                let userRoomID = null;

                // Find if the user is already in a video room
                for (const roomID in videoRooms) {
                    if (videoRooms[roomID].includes(user.id)) {
                        userRoomID = roomID;
                        break;
                    }
                }
                if(userRoomID!=null)
                {
                    return;
                }

                let joinedRoom = false;
                // Check if user can join any existing room
                for (const roomID in videoRooms) {
                    const roomMembers = videoRooms[roomID];

                    // Check if the user is already in the room
                    if (roomMembers.includes(user.id)) continue;

                    console.log("roomMembers ",roomMembers);

                    // Ensure user is in proximity to **all** current members
                    const canJoin = roomMembers.every((memberID) => {
                        const member = usersInRoom.find((u) => u.id === memberID);
                        console.log("member ",member);
                        return member && calculateDistance(user.x, user.y, member.x, member.y) < proximityDistance;
                    });

                    if (canJoin) {
                        console.log("video-start new user ", user);
                        videoRooms[roomID].push(user.id);
                        io.to(user.id).emit("video-call-start", roomID);
                        joinedRoom = true;
                        return;
                    }
                }

                // If no suitable existing room, check if a new room should be created
                if (!joinedRoom) {
                    for (const otherUser of usersInRoom) {
                        if (user.id === otherUser.id) continue; // Skip self-comparison
                
                        // Check if the other user is already in a room
                        const otherUserRoom = Object.entries(videoRooms).find(([_, members]) => 
                            members.includes(otherUser.id)
                        );
                
                        if (otherUserRoom) continue; // Skip if the other user is in a room
                
                        const distance = calculateDistance(user.x, user.y, otherUser.x, otherUser.y);
                        if (distance < proximityDistance) {
                            // Create a new room if the user has no room
                            if (!userRoomID) {
                                console.log("video-start two users:", user, otherUser);
                                const newRoomID = `room-${user.id}-${otherUser.id}`;
                                videoRooms[newRoomID] = [user.id, otherUser.id];
                
                                io.to(user.id).emit("video-call-start", newRoomID);
                                io.to(otherUser.id).emit("video-call-start", newRoomID);
                                return;
                            }
                        }
                    }
                }
                
            });

            // remove

            usersInRoom.forEach((user) => {
                let userRoomID = null;

                // Find if the user is already in a video room
                for (const roomID in videoRooms) {
                    if (videoRooms[roomID].includes(user.id)) {
                        userRoomID = roomID;
                        break;
                    }
                }
                if(userRoomID==null)
                        return;
                
                for (const roomID in videoRooms) {
                    const roomMembers = videoRooms[roomID];

                    // Check if the user is already in the room
                    // if (!roomMembers.includes(user.id)) continue;

                    // Ensure user is in proximity to **all** current members
                    const canRemove = roomMembers.some((memberID) => {
                        if (memberID === user.id) return false; // Ignore self-check
                        const member = usersInRoom.find((u) => u.id === memberID);
                        return member && calculateDistance(user.x, user.y, member.x, member.y) > proximityDistance;
                    });

                    // console.log("canRemove ",canRemove);

                    if (canRemove && userRoomID) {
                        console.log("video-end user ", user);
                        videoRooms[roomID] = videoRooms[roomID].filter((memberID) => memberID !== user.id);
                        io.to(user.id).emit("video-call-end");

                        if (videoRooms[roomID].length === 1) {
                            const lastUserID = videoRooms[roomID][0];
                            console.log("video-call-end for last user ", lastUserID);
                            io.to(lastUserID).emit("video-call-end");
                            delete videoRooms[roomID]; // Remove the empty room
                        }

                        return;
                    }
                    // console.log("videoRooms List ",videoRooms); 
                    if (videoRooms[roomID].length === 1) {
                        const lastUserID = videoRooms[roomID][0];
                        console.log("video-call-end for last user ", lastUserID);
                        io.to(lastUserID).emit("video-call-end");
                        delete videoRooms[roomID]; // Remove the empty room
                    }
                    if (videoRooms[roomID]?.length === 0) {
                        delete videoRooms[roomID];
                    }
                }

            })

        });
    }, 1000); // Run proximity check every second


});
