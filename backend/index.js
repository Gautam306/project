const { Server } = require("socket.io");

const io = new Server(8002, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});


const activeUsers = {}; // Tracks users by socket ID
const UserCorrespondingRoom = {}; // Tracks users per room (mapId)

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
                y: 3840-100,
                anim: "walk-up",
            };

            

            // Join the user to the specific room
            socket.join(mapId);
            UserCorrespondingRoom[mapId].push(activeUsers[socket.id]);

            console.log("User added:", username, "Map ID:", mapId," ",UserCorrespondingRoom[mapId]);

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
    socket.on("player-meet",(mapId)=>{
        console.log("player-meet ",mapId,"  ",socket.id);
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

                console.log("disconnect user ",UserCorrespondingRoom[mapId]);
                // Notify the room of the updated player list
                io.to(mapId).emit("currentPlayers", UserCorrespondingRoom[mapId]);
            }

            // Notify others in the room that the user left
            io.to(mapId).emit("user-left", socket.id);
        }
    });
});
