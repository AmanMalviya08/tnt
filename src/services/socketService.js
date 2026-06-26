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

    socket.on("join-tour-status", (tourId) => {
      if (tourId) socket.join(`tour-status:${tourId}`);
    });

    socket.on("leave-tour-status", (tourId) => {
      if (tourId) socket.leave(`tour-status:${tourId}`);
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

const tourStatusStreamListeners = new Map();

function emitTourStatusUpdate(tourId, data) {
  if (!tourId) return;
  const room = `tour-status:${tourId}`;
  if (io) {
    io.to(room).emit("tour-status-update", data);
  }
  const listeners = tourStatusStreamListeners.get(String(tourId));
  if (listeners) {
    listeners.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.warn("[Socket] tour-status listener error:", err.message);
      }
    });
  }
}

function subscribeTourStatusStream(tourId, callback) {
  const key = String(tourId);
  if (!tourStatusStreamListeners.has(key)) {
    tourStatusStreamListeners.set(key, new Set());
  }
  tourStatusStreamListeners.get(key).add(callback);
  return () => {
    const set = tourStatusStreamListeners.get(key);
    if (set) {
      set.delete(callback);
      if (set.size === 0) tourStatusStreamListeners.delete(key);
    }
  };
}

module.exports = {
  initSocket,
  getIO,
  emitTourTrackingUpdate,
  emitSeatUpdate,
  emitTourStatusUpdate,
  subscribeTourStatusStream,
};
