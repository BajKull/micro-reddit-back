const { addComment } = require("./pg");

const httpServer = require("http").createServer();
const io = require("socket.io")(httpServer, {
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST"],
  },
});

const socketInit = () => {
  io.on("connection", (socket) => {
    console.log(`${socket.id} connected`);

    socket.on("joinComments", ({ path }) => {
      socket.join(path);
      console.log(socket.rooms);
    });

    socket.on("commentSend", ({ path, user, content, postId }) => {
      console.log(path);
      const data = { userId: user.id, content, postId };
      addComment(data);
      socket
        .to(path)
        .emit("commentReceive", { nickname: user.username, content });
    });
  });

  httpServer.listen(5050);
};

module.exports = { socketInit };
