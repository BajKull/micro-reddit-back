require("dotenv").config();
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const passport = require("passport");
const passportInit = require("./passport");
const {
  createUser,
  reAuthenticate,
  changePassword,
  changeEmail,
  getSubreddits,
  getSubredditsAll,
  getSubreddit,
  createSubreddit,
  createPost,
  likePost,
  getUserByName,
  joinSubreddit,
  getLanding,
  getSearch,
  getPost,
  subredditEdit,
  deletePost,
} = require("./pg");
const { socketInit } = require("./socket.js");

passportInit(passport);
socketInit();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "http://localhost:8080" }));
app.use(express.json());
app.use(
  session({
    secret: "a25vlga2vku5ya2vku6",
    resave: true,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/", (req, res) => {
  res.send("hello world");
});

app.post("/signIn", passport.authenticate("local"), async (req, res) => {
  const user = await getUserByName(req.user.nickname);
  req.login(user, (err) => {
    if (err) console.log(err);
  });
  res.send({ user, sessionID: req.sessionID });
});

app.post("/signOut", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.log(err);
    req.logout();
    res.sendStatus(200);
  });
});

app.post("/signUp", (req, res) => {
  const user = req.body;
  createUser(user)
    .then(async () => {
      const resUser = await getUserByName(user.username);
      res.send(resUser);
    })
    .catch((err) => {
      console.log(err);
      res.status(400).send(err);
    });
});

app.post("/initAuth", async (req, res) => {
  const id = req.body.sessionID;
  const session = req.sessionStore.sessions[id];
  if (session) {
    const userId = JSON.parse(session).passport.user;
    if (userId) {
      const user = await getUserByName(null, userId);
      if (user) {
        res.send(user);
        return;
      }
    }
  }
  res.status(400).send("Session expired or no longer exists.");
});

app.post("/changePassword", async (req, res) => {
  const { id, password, newPassword } = req.body;
  reAuthenticate(id, password)
    .then(() => {
      changePassword(id, newPassword)
        .then(res.sendStatus(200))
        .catch((err) => res.status(401).send(err));
    })
    .catch((err) => res.status(401).send(err));
});

app.post("/changeEmail", async (req, res) => {
  const { id, email, password } = req.body;
  reAuthenticate(id, password)
    .then(() => {
      changeEmail({ id, email })
        .then(() => res.sendStatus(200))
        .catch((err) => res.status(401).send(err));
    })
    .catch((err) => res.status(401).send(err));
});

app.get("/subreddits", async (req, res) => {
  getSubreddits(req.query)
    .then((data) => res.send(data))
    .catch((err) => res.status(401).send(err));
});
app.get("/subredditsAll", async (req, res) => {
  getSubredditsAll(req.query)
    .then((data) => res.send(data))
    .catch((err) => res.status(401).send(err));
});

app.get("/subreddit/:subreddit", async (req, res) => {
  const subreddit = req.params.subreddit;
  const sort = req.query.sort;
  const user = req.query.user;

  getSubreddit(subreddit, user, sort)
    .then((data) => res.send(data))
    .catch((err) => {
      res.status(401).send(err);
      console.log(err);
    });
});

app.post("/createSubreddit", async (req, res) => {
  const { name, desc, user } = req.body;
  createSubreddit(name, desc, user)
    .then((data) => res.send(data))
    .catch((err) => res.status(401).send(err));
});

app.post("/createPost", async (req, res) => {
  createPost(req.body.data)
    .then(() => res.sendStatus(200))
    .catch((err) => res.status(401).send(err));
});

app.post("/likePost", (req, res) => {
  likePost(req.body.data);
});

app.post("/joinSubreddit", (req, res) => {
  joinSubreddit(req.body);
});

app.get("/getLanding", (req, res) => {
  getLanding(req.query)
    .then((data) => res.send(data))
    .catch((err) => res.status(401).send(err));
});

app.get("/getSearch", (req, res) => {
  getSearch(req.query)
    .then((data) => res.send(data))
    .catch((err) => res.status(400).send(err));
});

app.get("/getPost", (req, res) => {
  getPost(req.query)
    .then((data) => res.send(data))
    .catch((err) => res.status(400).send(err));
});

app.post("/subredditEdit", (req, res) => {
  subredditEdit(req.body)
    .then(() => res.sendStatus(200))
    .catch((err) => res.status(400).send(err));
});

app.post("/deletePost", (req, res) => {
  deletePost(req.body)
    .then(() => res.sendStatus(200))
    .catch((err) => res.status(400).send(err));
});

app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});
