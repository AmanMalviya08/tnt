let io = null;

function resolveRoom(event, payload) {
  if (payload == null || payload === "") return null;

  switch (event) {
    case "join-tour-tracking":
      return `tracking:${payload}`;
    case "join-guide-tracking":
      return `guide-tracking:${payload}`;
    case "join-tour-status":
      return `tour-status:${payload}`;
    case "join-tour-seats":
      return `seats:${payload}`;
    default:
      return null;
  }
}

function joinRoom(socket, event, payload) {
  const room = resolveRoom(event, payload);
  if (room) socket.join(room);
  return room;
}

function leaveRoom(socket, event, payload) {
  const joinEvent = event.startsWith("leave-")
    ? event.replace("leave-", "join-")
    : event;
  const room = resolveRoom(joinEvent, payload);
  if (room) socket.leave(room);
  return room;
}

function initSocket(server) {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    pingInterval: 25000,
    pingTimeout: 20000,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });

  io.on("connection", (socket) => {
    socket.emit("connection-ready", {
      socketId: socket.id,
      ts: Date.now(),
    });

    socket.on("join-tour-tracking", (shareToken) => {
      joinRoom(socket, "join-tour-tracking", shareToken);
    });

    socket.on("leave-tour-tracking", (shareToken) => {
      leaveRoom(socket, "leave-tour-tracking", shareToken);
    });

    socket.on("join-tour-seats", (tourId) => {
      joinRoom(socket, "join-tour-seats", tourId);
    });

    socket.on("leave-tour-seats", (tourId) => {
      leaveRoom(socket, "leave-tour-seats", tourId);
    });

    socket.on("join-tour-status", (tourId) => {
      joinRoom(socket, "join-tour-status", tourId);
    });

    socket.on("leave-tour-status", (tourId) => {
      leaveRoom(socket, "leave-tour-status", tourId);
    });

    socket.on("join-guide-tracking", (guideId) => {
      joinRoom(socket, "join-guide-tracking", guideId);
    });

    socket.on("leave-guide-tracking", (guideId) => {
      leaveRoom(socket, "leave-guide-tracking", guideId);
    });

    /** Re-join all rooms after client reconnects (location still saved via REST). */
    socket.on("sync-subscriptions", (subs = []) => {
      if (!Array.isArray(subs)) return;

      let joined = 0;
      for (const sub of subs) {
        const event = sub?.event;
        const payload = sub?.payload;
        if (joinRoom(socket, event, payload)) joined += 1;
      }

      socket.emit("subscriptions-synced", {
        count: joined,
        ts: Date.now(),
      });
    });

    socket.on("ping-tracking", (callback) => {
      if (typeof callback === "function") {
        callback({ ok: true, ts: Date.now() });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.io] Client disconnected (${socket.id}): ${reason}`);
    });
  });

  console.log("[Socket.io] Initialized with reconnection recovery");
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

function emitGuideTrackingUpdate(guideId, data) {
  if (io && guideId) {
    io.to(`guide-tracking:${guideId}`).emit("guide-tracking-update", data);
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
  emitGuideTrackingUpdate,
  emitSeatUpdate,
  emitTourStatusUpdate,
  subscribeTourStatusStream,
};
