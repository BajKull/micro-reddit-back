const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

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

const getSubreddit = async (name, user = null) => {
  return new Promise(async (res, rej) => {
    const subreddit = await pool
      .query(
        `
        SELECT subreddit.name, post.id, post.title, post.content, post.image_path, post.video_url, COUNT(comment.id) AS comments, COALESCE(SUM(post_vote.vote), 0) as votes
        FROM subreddit 
        LEFT JOIN post ON subreddit.id = post.subreddit_id 
        LEFT JOIN post_vote on post.id = post_vote.post_id 
        LEFT JOIN comment ON post.id = comment.post_id 
        WHERE subreddit.name = '${name}' 
        GROUP BY subreddit.name, post.id, post.title, post.content, post.image_path, post.video_url;`
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    if (user && user !== "noUser") {
      const userVotes = await pool.query(
        `SELECT * FROM post_vote WHERE user_id = ${user}`
      );
      userVotes.rows.forEach((vote) => {
        const s = subreddit.rows.find((r) => r.id === vote.post_id);
        if (s)
          subreddit.rows.find((r) => r.id === vote.post_id).voted = vote.vote;
      });
    }
    res(subreddit.rows);
  });
};

const createSubreddit = (name, desc, user) => {
  return new Promise(async (res, rej) => {
    const exists = await pool.query(
      `SELECT * FROM subreddit WHERE name = '${name}'`
    );
    if (exists.rows.length > 0) {
      rej("Subreddit name has already been taken.");
      return;
    }
    await pool.query(
      `INSERT INTO subreddit (name, description) VALUES ('${name}', '${desc}');`
    );
    const q = await pool.query(
      `SELECT * FROM subreddit WHERE name = '${name}'`
    );
    const subreddit = q.rows[0];
    if (subreddit) {
      await pool.query(
        `INSERT INTO subreddit_user (user_id, subreddit_id) VALUES ('${user}', '${subreddit.id}');`
      );
      await pool.query(
        `INSERT INTO subreddit_moderator (user_id, subreddit_id) VALUES ('${user}', '${subreddit.id}');`
      );
      subreddit.moderator = true;
      res(subreddit);
    } else rej(`Couldn't connect to the database.`);
  });
};

const createPost = (data) => {
  const { name, content, image, video, survey, subredditId, userId } = data;
  return new Promise(async (res, rej) => {
    const idQ = await pool
      .query(`SELECT id FROM subreddit WHERE name = '${subredditId}';`)
      .catch(() => rej(`Couldn't connect to the database.`));
    const { id } = idQ.rows[0];
    if (!id) {
      rej(`Subreddit no longer exists.`);
      return;
    }
    await pool
      .query(
        `
      INSERT INTO post (title, content${image ? ", image" : ""}${
          video ? ", video" : ""
        }, creation_date, subreddit_id, user_id)
      VALUES ('${name}', '${content}'${image ? ", '" + image + "'" : ""}${
          video ? ", '" + video + "'" : ""
        }, NOW(), ${id}, ${userId});
    `
      )
      .catch(() => rej(`Couldn't connect to the database.`));
    const postQ = await pool.query(
      `SELECT id FROM post WHERE title = '${name}' AND content = '${content}' AND subreddit_id = ${id} AND user_id = ${userId}`
    );
    const postId = postQ.rows[0].id;
    if (survey) {
      await pool
        .query(
          `
        INSERT INTO survey (question, post_id) VALUES ('${survey.question}', ${postId})
      `
        )
        .catch(() => rej(`Couldn't connect to the database.`));
      const surveyQ = await pool
        .query(
          `SELECT id from survey WHERE question = '${survey.question}' AND post_id = ${postId}`
        )
        .catch(() => rej(`Couldn't connect to the database.`));
      const surveyId = surveyQ.rows[0].id;
      await pool
        .query(
          `INSERT INTO survey_answer (answer, survey_id) VALUES${survey.answers.map(
            (a) => "('" + a.answer + "', " + surveyId + ")"
          )}`
        )
        .catch(() => rej(`Couldn't connect to the database.`));
    }
    res(postId);
  });
};

const likePost = async (data) => {
  const { value, postId, userId } = data;
  console.log(data);
  if (!value || !postId || !userId) return;
  const alreadyLikedQ = await pool.query(
    `SELECT * FROM post_vote WHERE post_id = ${postId} AND user_id = ${userId}`
  );
  if (alreadyLikedQ.rows.length > 0) {
    const alreadyLiked = alreadyLikedQ.rows[0].vote;
    if (alreadyLiked === value)
      await pool.query(
        `DELETE FROM post_vote WHERE user_id = ${userId} AND post_id = ${postId}`
      );
    else
      await pool.query(
        `UPDATE post_vote SET vote = ${value} WHERE user_id = ${userId} AND post_id = ${postId}`
      );
  } else {
    await pool.query(
      `INSERT INTO post_vote (vote, user_id, post_id) VALUES (${value}, ${userId}, ${postId})`
    );
  }
};

module.exports = {
  pool,
  getUserById,
  createUser,
  reAuthenticate,
  changePassword,
  changeEmail,
  getSubreddits,
  getSubreddit,
  createSubreddit,
  createPost,
  likePost,
};
