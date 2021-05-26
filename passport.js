const { pool, getUserById } = require("./pg");
const LocalStragegy = require("passport-local").Strategy;

const passportInit = (passport) => {
  passport.use(
    new LocalStragegy((username, password, callback) => {
      pool.query(
        `SELECT * FROM reddit_user WHERE nickname = '${username}'`,
        (err, res) => {
          if (err) console.log(err);
          if (res.rows.length > 0) {
            const user = res.rows[0];
            if (user.password !== password) return callback(null, false);
            else return callback(null, user);
          }
          return callback(null, false);
        }
      );
    })
  );

  passport.serializeUser((user, callback) => {
    callback(null, user.id);
  });
  passport.deserializeUser(async (id, callback) => {
    const user = await getUserById(id);
    if (user) callback(null, user);
  });
};

module.exports = passportInit;
