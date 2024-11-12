export const setupSocketEvents = (io) => {
  io.on("connection", (socket) => {
    console.log("a user connected");

    socket.on("disconnect", () => {
      console.log("user disconnected");
    });

    // Here you can add more event listeners
    socket.on("custom-event", (data) => {
      console.log("Custom event received:", data);
      // Emit events to clients
      io.emit("custom-response", { message: "Event received!" });
    });
  });
};

export const emitJobEvent = (io, event, data) => {
  io.emit(event, data);
};
