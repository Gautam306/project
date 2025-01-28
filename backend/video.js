const { Server } = require("socket.io");

const io = new Server(8000, {
  cors: true,
});

const emailToSocketIdMap = new Map();
const socketidToEmailMap = new Map();

const socketID = [];
function disconnectAllUsers() {
  for (const [socketId, socket] of io.sockets.sockets) {
    console.log(`Disconnecting socket: ${socketId}`);
    if (socketID === socket.id) {
      socket.disconnect(true);
    }// Pass `true` to forcefully disconnect
  }
  console.log("All users have been disconnected.");
}
// disconnectAllUsers();

io.on("connection", (socket) => {
  console.log(`Socket Connected`, socket.id);
  socket.on("room:join", (data) => {
    const { email, room } = data;
    emailToSocketIdMap.set(email, socket.id);
    socketID.push(socket.id);
    console.log("user join with email room", room);
    socketidToEmailMap.set(socket.id, email);
    // if (socketID.length > 1) {
      io.to(room).emit("user:joined", { email, id: socket.id });
    // }
    console.log("user:joined ", email, "  ", socket.id)
    socket.join(room);
    io.to(socket.id).emit("room:join", data);
    // if (socketID.length > 1) {
      setTimeout(() => {
        const plainObject = Object.fromEntries(socketidToEmailMap);

        io.to(socket.id).emit("all:user", { data: socketID });

        console.log("all:user emitted", socketidToEmailMap, "to:", socket.id);
      }, 100); // 100ms delay
    // }
  });

  socket.on("user:call", ({ to, offer }) => {
    console.log("user:call ", to);
    io.to(to).emit("incomming:call", { from: socket.id, offer });
  });

  socket.on("call:accepted", ({ to, ans }) => {
    console.log("call:accepted ", to);
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    console.log("peer:nego:needed");
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    console.log("peer:nego:done");
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });
  socket.on("disconnect-player", () => {
    console.log("disconnect-player");
    socketID.filter((id) => id !== socket.id);

    const email = socketidToEmailMap.get(socket.id);
    // socket.broadcast.emit("user:left", { email, ids: socketID });
    io.to(socket.id).emit("all-user-before-disconnect", { data: socketID });
    console.log(`User ${socket.id} disconnected`, email);
    // disconnectAllUsers();
    // socket.broadcast.emit("user:left", { id: socket.id ,userSocket:socket});

  });

  socket.on("disconnect", () => {
    console.log(`Socket Disconnected`, socket.id);

    // Remove from maps
    const email = socketidToEmailMap.get(socket.id);
    if (email) {
      emailToSocketIdMap.delete(email);
      console.log(`Removed ${email} from emailToSocketIdMap`);
    }

    socketidToEmailMap.delete(socket.id);
    console.log(`Removed ${socket.id} from socketidToEmailMap`);
    socket.broadcast.emit("user:left", { email, id: socket.id });
    // Remove from the socketID array
    const index = socketID.indexOf(socket.id);
    if (index > -1) {
      socketID.splice(index, 1);
      console.log(`Removed ${socket.id} from socketID array`);
    }

    console.log(`user:left event emitted for ${email} (${socket.id})`);
    // disconnectAllUsers();
  });


  // Screen Share
  socket.on("screen:share:started", ({ to }) => {
    io.to(to).emit("screen:share:started", { from: socket.id });
  });

  socket.on("screen:share:stopped", ({ to }) => {
    io.to(to).emit("screen:share:stopped", { from: socket.id });
  });

  // Chat
  socket.on("chat:send", (data) => {
    const { message, timestamp, room } = data;
    const senderEmail = socketidToEmailMap.get(socket.id);
    console.log("data chat ", data, senderEmail, room);
    // Broadcast the message to all users in the room except the sender

    socket.to(room).emit("chat:message", {
      sender: senderEmail,
      message,
      timestamp
    });
    // io.emit("chat:message", {
    //   sender: senderEmail || "Unknown", // Fallback if no senderEmail
    //   message,
    //   timestamp,
    // });
  });
});