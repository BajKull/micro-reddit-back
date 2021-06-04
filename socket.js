const { addComment, deletePost } = require("./pg");

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

    socket.on("joinRoom", ({ path }) => {
      socket.join(path);
    });

    socket.on("commentSend", ({ path, user, content, postId }) => {
      const data = { userId: user.id, content, postId };
      addComment(data);
      socket
        .to(path)
        .emit("commentReceive", { nickname: user.username, content });
    });
    socket.on("deletePost", async ({ path, subredditName, user, id }) => {
      deletePost({ subredditName, user, id })
        .then(() => {
          console.log(path);
          socket.to(path).emit("deletePost", { id });
        })
        .catch(() => {});
    });
  });

  httpServer.listen(5050);
};

module.exports = { socketInit };
