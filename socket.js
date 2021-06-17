const { addComment, deletePost, deleteComment } = require("./pg");

const httpServer = require("http").createServer();
const io = require("socket.io")(httpServer, {
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST"],
  },
});

const socketInit = () => {
  io.on("connection", (socket) => {
    socket.on("joinRoom", ({ path }) => {
      socket.join(path);
    });

    socket.on("commentSend", async ({ path, user, content, postId }) => {
      const data = { userId: user.id, content, postId };
      const comment = await addComment(data);
      io.to(path).emit("commentReceive", comment);
    });
    socket.on(
      "deletePost",
      async ({ path, subredditName, user, id }, callback) => {
        deletePost({ subredditName, user, id })
          .then(() => {
            socket
              .to(`/r/${subredditName}`)
              .to(`/r/${subredditName}/${id}`)
              .emit("deletePost", { id });
            callback(true);
          })
          .catch(() => {});
      }
    );
    socket.on("deleteComment", ({ path, user, id, subredditName }) => {
      deleteComment({ subredditName, user, id })
        .then(() => {
          socket.to(path).emit("deleteComment", { id });
        })
        .catch(() => {});
    });
  });

  httpServer.listen(5050);
};

module.exports = { socketInit };
