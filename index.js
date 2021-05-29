require("dotenv").config();
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const passport = require("passport");
const passportInit = require("./passport");
const {
  createUser,
  getUserById,
  reAuthenticate,
  changePassword,
  changeEmail,
  getSubreddits,
  getSubreddit,
  createSubreddit,
  createPost,
  likePost,
} = require("./pg");

passportInit(passport);

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

app.post("/signIn", passport.authenticate("local"), (req, res) => {
  const user = req.user;
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
    .then((u) => res.send(u))
    .catch((err) => {
      res.status(400).send(err);
    });
});

app.post("/initAuth", async (req, res) => {
  const id = req.body.sessionID;
  const session = req.sessionStore.sessions[id];
  if (session) {
    const userId = JSON.parse(session).passport.user;
    if (userId) {
      const user = await getUserById(userId);
      if (user) {
        delete user.password;
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
      changeEmail(id, email)
        .then(res.sendStatus(200))
        .catch((err) => res.status(401).send(err));
    })
    .catch((err) => res.status(401).send(err));
});

app.get("/subreddits", async (req, res) => {
  getSubreddits()
    .then((data) => res.send(data))
    .catch((err) => res.status(401).send(err));
});

app.get("/subreddit/:subreddit", async (req, res) => {
  const subreddit = req.params.subreddit;
  const user = req.query.user;
  getSubreddit(subreddit, user)
    .then((data) => res.send(data))
    .catch((err) => res.status(401).send(err));
});

app.post("/createSubreddit", async (req, res) => {
  const { name, desc, user } = req.body;
  createSubreddit(name, desc, user)
    .then((data) => res.send(data))
    .catch((err) => res.status(401).send(err));
});

app.post("/createPost", async (req, res) => {
  createPost(req.body.data)
    .then((data) => res.send(data))
    .catch((err) => res.status(401).send(err));
});

app.post("/likePost", (req, res) => {
  likePost(req.body.data);
});

app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});
