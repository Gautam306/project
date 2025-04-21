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
                x: 1216/2, // Default position
                y: 1056/2,
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

            console.log(`Player moved: ${user.username} in Map ID: ${user.mapId}`);

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
                let userRoomID = Object.keys(videoRooms)?.find(roomID => videoRooms[roomID].includes(user.id));
                const roomMembers = videoRooms[userRoomID];
                videoRooms[userRoomID] = roomMembers?.filter(memberID => memberID !== user.id);
            }

            console.log("disconnect mapId",mapId);
            updateProximity(mapId);
            // Notify others in the room that the user left
            io.to(mapId).emit("user-left", socket.id);
        }
    });


    socket.on("move", (userData) => {
        const { userID, mapID, x, y } = userData;
            // console.log("move ",userID,mapID,x,y);
        
        // if (!UserCorrespondingRoom[mapID]) {
        //     UserCorrespondingRoom[mapID] = [];
        // }

        // const userIndex = UserCorrespondingRoom[mapID].findIndex(u => u.id === userID);
        // if (userIndex !== -1) {
        //     UserCorrespondingRoom[mapID][userIndex] = { id: userID, x, y };
        // } else {
        //     UserCorrespondingRoom[mapID].push({ id: userID, x, y });
        // }

        
        updateProximity(mapID);
    });

    // setInterval(() => {
    //     Object.keys(UserCorrespondingRoom).forEach((mapId) => {
    //         const usersInRoom = UserCorrespondingRoom[mapId];
    //         const userPositions = new Map(usersInRoom.map(user => [user.id, user]));
            
    //         const usersToRemove = new Set();
    //         const usersInRooms = new Set(); // Track users already assigned to a room
    //         const roomsToDelete = new Set();
    
    //         // Step 1: Mark users for removal if they move out of range
    //         Object.keys(videoRooms).forEach((roomID) => {
    //             const roomMembers = videoRooms[roomID];
    
    //             roomMembers.forEach((userID) => {
    //                 const user = userPositions.get(userID);
    //                 if (!user) return;
    
    //                 const isFar = roomMembers.some((memberID) => {
    //                     if (memberID === userID) return false;
    //                     const member = userPositions.get(memberID);
    //                     return member && calculateDistance(user.x, user.y, member.x, member.y) > proximityDistance;
    //                 });
    
    //                 if (isFar) usersToRemove.add(userID);
    //             });
    //         });
    
    //         // Step 2: Try to assign users to existing rooms
    //         usersInRoom.forEach((user) => {
    //             if (usersToRemove.has(user.id)) return;
    
    //             let assignedRoom = null;
    
    //             for (const roomID in videoRooms) {
    //                 const roomMembers = videoRooms[roomID];
    
    //                 if (roomMembers.includes(user.id)) {
    //                     assignedRoom = roomID;
    //                     usersInRooms.add(user.id);
    //                     break;
    //                 }
    
    //                 const canJoin = roomMembers.every((memberID) => {
    //                     const member = userPositions.get(memberID);
    //                     return member && calculateDistance(user.x, user.y, member.x, member.y) <= proximityDistance;
    //                 });
    
    //                 if (canJoin) {
    //                     videoRooms[roomID].push(user.id);
    //                     io.to(user.id).emit("video-call-start", roomID);
    //                     usersInRooms.add(user.id);
    //                     return;
    //                 }
    //             }
    
    //             // Step 3: If no existing room, try to create a new one
    //             if (!assignedRoom) {
    //                 for (const otherUser of usersInRoom) {
    //                     if (user.id === otherUser.id || usersInRooms.has(otherUser.id)) continue;
    
    //                     const distance = calculateDistance(user.x, user.y, otherUser.x, otherUser.y);
    //                     if (distance <= proximityDistance) {
    //                         const newRoomID = `room-${user.id}-${otherUser.id}`;
    //                         videoRooms[newRoomID] = [user.id, otherUser.id];
    
    //                         io.to(user.id).emit("video-call-start", newRoomID);
    //                         io.to(otherUser.id).emit("video-call-start", newRoomID);
    //                         usersInRooms.add(user.id);
    //                         usersInRooms.add(otherUser.id);
    //                         return;
    //                     }
    //                 }
    //             }
    //         });
    
    //         // Step 4: Remove users who moved out of proximity
    //         usersToRemove.forEach((userID) => {
    //             for (const roomID in videoRooms) {
    //                 if (!videoRooms[roomID].includes(userID)) continue;
    
    //                 videoRooms[roomID] = videoRooms[roomID].filter(id => id !== userID);
    //                 io.to(userID).emit("video-call-end");
    
    //                 if (videoRooms[roomID].length === 1) {
    //                     const lastUserID = videoRooms[roomID][0];
    //                     io.to(lastUserID).emit("video-call-end");
    //                     roomsToDelete.add(roomID);
    //                 }
    //             }
    //         });
    
    //         // Step 5: Delete empty rooms safely
    //         roomsToDelete.forEach((roomID) => {
    //             delete videoRooms[roomID];
    //         });
    
    //     });
    // }, 100);
    


});


// Function to check proximity and update rooms
function updateProximity(mapID) {
    Object.entries(UserCorrespondingRoom).forEach(([mapID, usersInRoom]) => {
        usersInRoom.forEach((user) => {
            let userRoomID = Object.keys(videoRooms).find(roomID => videoRooms[roomID].includes(user.id));
            
            if (userRoomID) return; // Skip if user is already in a room

            let joinedRoom = false;
            
            for (const [roomID, roomMembers] of Object.entries(videoRooms)) {
                if (roomMembers.includes(user.id)) continue;

                if (roomMembers.every(memberID => {
                    const member = usersInRoom.find(u => u.id === memberID);
                    return member && calculateDistance(user.x, user.y, member.x, member.y) <= proximityDistance;
                })) {
                    console.log("video-start new user", user);
                    roomMembers.push(user.id);
                    io.to(user.id).emit("video-call-start", roomID);
                    joinedRoom = true;
                    break;
                }
            }
            
            if (!joinedRoom) {
                for (const otherUser of usersInRoom) {
                    if (user.id === otherUser.id) continue;

                    if (Object.values(videoRooms).some(members => members.includes(otherUser.id))) continue;

                    if (calculateDistance(user.x, user.y, otherUser.x, otherUser.y) <= proximityDistance) {
                        const newRoomID = `room-${user.id}-${otherUser.id}`;
                        console.log("video-start two users:", user, otherUser);
                        videoRooms[newRoomID] = [user.id, otherUser.id];
                        io.to(user.id).emit("video-call-start", newRoomID);
                        io.to(otherUser.id).emit("video-call-start", newRoomID);
                        break;
                    }
                }
            }
        });

        usersInRoom.forEach((user) => {
           
            let userRoomID = Object.keys(videoRooms).find(roomID => videoRooms[roomID]?.includes(user?.id));
            console.log("del user ",user,"  ",userRoomID);
            if (!userRoomID) return;

            const roomMembers = videoRooms[userRoomID];
            console.log("roomMembers ",roomMembers);
            if (roomMembers.some(memberID => {
                if (memberID === user.id) return false;
                const member = usersInRoom.find(u => u.id === memberID);
                return member && calculateDistance(user.x, user.y, member.x, member.y) > proximityDistance;
            })) {
                console.log("video-end user", user);
                videoRooms[userRoomID] = roomMembers.filter(memberID => memberID !== user.id);
                io.to(user.id).emit("video-call-end");
            }
            
            if (videoRooms[userRoomID]?.length === 1) {
                const lastUserID = videoRooms[userRoomID][0];
                console.log("video-call-end for last user", lastUserID);
                io.to(lastUserID).emit("video-call-end");
                delete videoRooms[userRoomID];
            }
            
            if (videoRooms[userRoomID]?.length === 0) {
                delete videoRooms[userRoomID];
            }
        });
    });
}
