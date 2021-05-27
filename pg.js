const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

const tet = () => {
  pool.query("SELECT * FROM subreddit;", (err, res) => {
    console.log(err, res.rows);
    pool.end();
  });
};

const getUserById = async (id) => {
  const user = await pool.query(`SELECT * FROM reddit_user WHERE id = ${id};`);
  return user.rows[0];
};

const createUser = async (user) => {
  return new Promise(async (res, rej) => {
    const { username, email, password } = user;
    const uTaken = await pool.query(
      `SELECT * FROM reddit_user WHERE nickname = '${username}';`
    );
    if (uTaken.rows.length > 0) {
      rej("Username taken.");
      return;
    }
    const eTaken = await pool.query(
      `SELECT * FROM reddit_user WHERE email = '${email}';`
    );
    if (eTaken.rows.length > 0) {
      rej("This email has already been registered.");
      return;
    }
    await pool.query(
      `INSERT INTO reddit_user (nickname, activation_guid, activation_expire_date, password, email) VALUES('${username}', NULL, NULL, '${password}', '${email}');`
    );
    res(true);
  });
};

const reAuthenticate = async (id, password) => {
  return new Promise(async (res, rej) => {
    const u = await pool
      .query(
        `SELECT * FROM reddit_user WHERE id = ${id} AND password = '${password}';`
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    const user = u.rows[0];
    if (user) res(true);
    else rej("Invalid password.");
  });
};

const changePassword = async (id, password) => {
  return new Promise(async (res, rej) => {
    await pool
      .query(
        `UPDATE reddit_user SET password = '${password}' WHERE id = ${id};`
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    res(true);
  });
};

const changeEmail = async (id, email) => {
  return new Promise(async (res, rej) => {
    await pool
      .query(`UPDATE reddit_user SET email = '${email}' WHERE id = '${id}';`)
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    res(true);
  });
};

const getSubreddits = async () => {
  return new Promise(async (res, rej) => {
    const subreddits = await pool
      .query(
        `
        SELECT subreddit.id, subreddit.name, subreddit.description, COUNT(subreddit_user.id) as users 
        FROM subreddit inner join subreddit_user on subreddit.id = subreddit_user.subreddit_id 
        GROUP BY subreddit.name, subreddit.id, subreddit.description;`
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    res(subreddits.rows);
  });
};

const getSubreddit = async (name) => {
  return new Promise(async (res, rej) => {
    const subreddit = await pool
      .query(
        `
        SELECT subreddit.name, post.id, post.title, post.content, post.image_path, post.video_url, COUNT(comment.id) AS comments, SUM(post_vote.id) AS votes
        FROM subreddit 
        LEFT JOIN post ON subreddit.id = post.subreddit_id 
        LEFT JOIN comment ON post.id = comment.post_id 
        LEFT JOIN post_vote on post.id = post_vote.post_id 
        WHERE subreddit.name = '${name}' 
        GROUP BY subreddit.name, post.id, post.title, post.content, post.image_path, post.video_url;`
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    console.log(subreddit.rows);
    res(subreddit.rows);
  });
};

exports.tet = tet;
exports.pool = pool;
exports.getUserById = getUserById;
exports.createUser = createUser;
exports.reAuthenticate = reAuthenticate;
exports.changePassword = changePassword;
exports.changeEmail = changeEmail;
exports.getSubreddits = getSubreddits;
exports.getSubreddit = getSubreddit;
