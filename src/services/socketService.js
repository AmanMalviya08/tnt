let io = null;

function initSocket(server) {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    socket.on("join-tour-tracking", (shareToken) => {
      if (shareToken) socket.join(`tracking:${shareToken}`);
    });

    socket.on("leave-tour-tracking", (shareToken) => {
      if (shareToken) socket.leave(`tracking:${shareToken}`);
    });

    socket.on("join-tour-seats", (tourId) => {
      if (tourId) socket.join(`seats:${tourId}`);
    });

    socket.on("leave-tour-seats", (tourId) => {
      if (tourId) socket.leave(`seats:${tourId}`);
    });
  });

  console.log("[Socket.io] Initialized");
  return io;
}

function getIO() {
  return io;
}

function emitTourTrackingUpdate(shareToken, data) {
  if (io && shareToken) {
    io.to(`tracking:${shareToken}`).emit("tour-tracking-update", data);
  }
}

function emitSeatUpdate(tourId, data) {
  if (io && tourId) {
    io.to(`seats:${tourId}`).emit("seat-update", data);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitTourTrackingUpdate,
  emitSeatUpdate,
};
