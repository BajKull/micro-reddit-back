const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

const howToSort = (s) => {
  if (s === "newest") return "ORDER BY post.creation_date DESC";
  if (s === "popular") return "ORDER BY votes DESC, comments DESC";
  return "";
};
const howToSortSubreddits = (s) => {
  if (s === "users") return "ORDER BY COUNT(subreddit_user.id) DESC";
  if (s === "posts")
    return "ORDER BY (SELECT COALESCE(COUNT(id), 0) as posts FROM post WHERE subreddit.id = post.subreddit_id) DESC";
};

const getUserById = async (id) => {
  const user = await pool.query(`SELECT * FROM reddit_user WHERE id = ${id};`);
  return user.rows[0];
};

const getUserByName = async (username = null, id = null) => {
  let u;
  if (username) {
    u = await pool.query(
      `SELECT * FROM reddit_user WHERE nickname = '${username}'`
    );
  } else {
    u = await pool.query(`SELECT * FROM reddit_user WHERE id = ${id}`);
  }
  u = u.rows[0];
  const subredditsQ = await pool.query(
    `SELECT name FROM subreddit_user INNER JOIN subreddit ON subreddit_user.subreddit_id = subreddit.id WHERE user_id = ${u.id}`
  );
  const moderatorQ = await pool.query(
    `SELECT subreddit.name FROM subreddit_moderator INNER JOIN subreddit on subreddit_moderator.subreddit_id = subreddit.id WHERE user_id = ${u.id}`
  );
  const subreddits = subredditsQ.rows.map((r) => r.name);
  const user = {
    id: u.id,
    username: u.nickname,
    email: u.email,
    subreddits,
    moderator: moderatorQ.rows.map((m) => m.name),
  };
  return user;
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

const changeEmail = async ({ id, email }) => {
  return new Promise(async (res, rej) => {
    const emailQ = await pool.query(
      `SELECT email FROM reddit_user WHERE email = '${email}'`
    );
    if (emailQ.rows.length > 0) {
      rej(`Email adress is already taken.`);
      return;
    }
    await pool
      .query(`UPDATE reddit_user SET email = '${email}' WHERE id = '${id}';`)
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    res(true);
  });
};

const getSubredditsAll = async (data) => {
  return new Promise(async (res, rej) => {
    const { sort, limit } = data;
    const subreddits = await pool
      .query(
        `
        SELECT subreddit.id, subreddit.name, subreddit.description,
        (SELECT COUNT(subreddit_user.id) as users FROM subreddit_user WHERE subreddit_id = subreddit.id),
        (SELECT COALESCE(COUNT(id), 0) as posts FROM post WHERE subreddit.id = post.subreddit_id) 
        FROM subreddit inner join subreddit_user on subreddit.id = subreddit_user.subreddit_id 
        GROUP BY subreddit.name, subreddit.id, subreddit.description 
        ${howToSortSubreddits(sort)} 
        ${limit === "true" ? "LIMIT 5" : ""}
        `
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    res(subreddits.rows);
  });
};

const getSubreddits = async (data) => {
  const { user, sort } = data;
  if (!user) return;
  return new Promise(async (res, rej) => {
    const subreddits = await pool
      .query(
        `
        SELECT subreddit.id, subreddit.name, subreddit.description,
        (SELECT COUNT(subreddit_user.id) as users FROM subreddit_user WHERE subreddit_id = subreddit.id),
        (SELECT COALESCE(COUNT(id), 0) as posts FROM post WHERE subreddit.id = post.subreddit_id) 
        FROM subreddit inner join subreddit_user on subreddit.id = subreddit_user.subreddit_id 
        WHERE subreddit_user.user_id = ${user}
        GROUP BY subreddit.name, subreddit.id, subreddit.description 
        ${howToSortSubreddits(sort)}
        LIMIT 5
        `
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    res(subreddits.rows);
  });
};

const getSubreddit = async (name, user = null, sort = null) => {
  return new Promise(async (res, rej) => {
    const subreddit = await pool
      .query(
        `        
        select post.id, post.creation_date, post.title, post.content, post.image_path, post.video_url, subreddit.name, 
        (SELECT COUNT(comment.id) as comments FROM comment WHERE post.id = comment.post_id), 
        (SELECT COALESCE(SUM(vote), 0) as votes FROM post_vote WHERE post_id = post.id) 
        FROM post inner join subreddit on subreddit.id = post.subreddit_id 
        WHERE post.id IS NOT NULL AND subreddit.name = '${name}'
        ${howToSort(sort)}`
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

const createPost = (image, data) => {
  const { name, content, video, survey, subredditId, userId } = data;
  if (data.survey === "null") data.survey = null;
  if (data.video === "null") data.video = null;
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
        SET TIMEZONE = 'Europe/Warsaw';
      INSERT INTO post (title, content${image ? ", image_path" : ""}${
          video ? ", video_url" : ""
        }, creation_date, subreddit_id, user_id)
      VALUES ('${name}', '${content}'${
          image ? ", '" + image.path.split("\\").pop() + "'" : ""
        }${video ? ", '" + video + "'" : ""}, NOW(), ${id}, ${userId});
    `
      )
      .catch(() => rej(`Couldn't connect to the database.`));
    const postQ = await pool.query(
      `SELECT id FROM post WHERE title = '${name}' AND content = '${content}' AND subreddit_id = ${id} AND user_id = ${userId}`
    );
    const postId = postQ.rows[0].id;
    if (survey !== "null") {
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

const joinSubreddit = async (data) => {
  const { subredditId, userId } = data;
  const idQ = await pool.query(
    `SELECT id FROM subreddit WHERE name = '${subredditId}'`
  );
  if (idQ.rows.length === 0) return;
  const id = idQ.rows[0].id;
  const memberQ = await pool.query(
    `SELECT * FROM subreddit_user WHERE user_id = ${userId} AND subreddit_id = ${id}`
  );
  if (memberQ.rows.length > 0) {
    pool.query(
      `DELETE FROM subreddit_user WHERE user_id = ${userId} AND subreddit_id = ${id}`
    );
  } else
    pool.query(
      `INSERT INTO subreddit_user (user_id, subreddit_id) VALUES (${userId}, ${id})`
    );
};

const getLanding = (data) => {
  return new Promise(async (res, rej) => {
    const { userId, sort } = data;

    if (userId) {
      const landingQ = await pool
        .query(
          `
          select post.id, post.creation_date, post.title, post.content, post.image_path, post.video_url, subreddit.name, 
          (SELECT COUNT(comment.id) as comments FROM comment WHERE post.id = comment.post_id), 
          (SELECT COALESCE(SUM(vote), 0) as votes FROM post_vote WHERE post_id = post.id) 
          FROM post 
          inner join subreddit on subreddit.id = post.subreddit_id 
          inner join subreddit_user on subreddit.id = subreddit_user.subreddit_id
          WHERE post.id IS NOT NULL AND subreddit_user.user_id = ${userId}
          ${howToSort(sort)}`
        )
        .catch(() => {
          rej(`Couldn't connect to the database.`);
          return;
        });
      const userVotes = await pool.query(
        `SELECT * FROM post_vote WHERE user_id = ${userId}`
      );
      userVotes.rows.forEach((vote) => {
        const s = landingQ.rows.find((r) => r.id === vote.post_id);
        if (s)
          landingQ.rows.find((r) => r.id === vote.post_id).voted = vote.vote;
      });
      res(landingQ.rows);
    } else {
      const landingQ = await pool
        .query(
          `
          select post.id, post.creation_date, post.title, post.content, post.image_path, post.video_url, subreddit.name, 
          (SELECT COUNT(comment.id) as comments FROM comment WHERE post.id = comment.post_id), 
          (SELECT COALESCE(SUM(vote), 0) as votes FROM post_vote WHERE post_id = post.id) 
          FROM post inner join subreddit on subreddit.id = post.subreddit_id 
          WHERE post.id IS NOT NULL
          ${howToSort(sort)}`
        )
        .catch(() => {
          rej(`Couldn't connect to the database.`);
          return;
        });
      res(landingQ.rows);
    }
  });
};

const getSearch = (data) => {
  return new Promise(async (res, rej) => {
    const { search, sortPosts, sortSubreddits } = data;
    const postsQ = await pool
      .query(
        `
        SELECT post.id, post.creation_date, post.title, post.content, post.image_path, post.video_url, subreddit.name, 
        (SELECT COUNT(comment.id) as comments FROM comment WHERE post.id = comment.post_id), 
        (SELECT COALESCE(SUM(vote), 0) as votes FROM post_vote WHERE post_id = post.id)
        FROM post inner join subreddit on subreddit.id = post.subreddit_id
        WHERE post.content LIKE '%${search}%'
        ${howToSort(sortPosts)}`
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    const subredditsQ = await pool
      .query(
        `
        SELECT subreddit.id, subreddit.name, subreddit.description, COUNT(subreddit_user.id) as users,
        (SELECT COALESCE(COUNT(id), 0) as posts FROM post WHERE subreddit.id = post.subreddit_id) 
        FROM subreddit inner join subreddit_user on subreddit.id = subreddit_user.subreddit_id 
        WHERE subreddit.name LIKE '%${search}%'
        GROUP BY subreddit.name, subreddit.id, subreddit.description 
        ${howToSortSubreddits(sortSubreddits)}`
      )
      .catch((err) => {
        rej(`Couldn't connect to the database.`);
        return;
      });

    const d = { posts: postsQ.rows, subreddits: subredditsQ.rows };
    res(d);
  });
};

const getPost = (data) => {
  const { postId, userId } = data;
  return new Promise(async (res, rej) => {
    const postQ = await pool
      .query(
        `
        select post.id, post.creation_date, post.title, post.content, post.image_path, post.video_url, subreddit.name, 
        (SELECT COUNT(comment.id) as comments FROM comment WHERE post.id = comment.post_id), 
        (SELECT COALESCE(SUM(vote), 0) as votes FROM post_vote WHERE post_id = post.id) 
        FROM post inner join subreddit on subreddit.id = post.subreddit_id 
        WHERE post.id = ${postId}`
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    const commentsQ = await pool
      .query(
        `
        select post.title, comment.post_id, comment.id, comment.content, reddit_user.nickname 
        from post 
        left join comment on post.id = comment.post_id 
        left join reddit_user on comment.user_id = reddit_user.id 
        where post.id = ${postId} AND comment.post_id IS NOT NULL`
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });

    const post = { ...postQ.rows[0], commentList: commentsQ.rows.reverse() };
    if (userId) {
      const userVote = await pool.query(
        `SELECT * FROM post_vote WHERE user_id = ${userId} AND post_id = ${postId}`
      );
      if (userVote.rows.length > 0) post.voted = userVote.rows[0].vote;
      else post.voted = 0;
    } else post.voted = 0;
    res(post);
  });
};

const addComment = (data) => {
  return new Promise(async (res, rej) => {
    const { content, userId, postId } = data;
    await pool
      .query(
        `INSERT INTO comment (content, user_id, post_id) VALUES ('${content}', ${userId}, ${postId})`
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    const comment = await pool
      .query(
        `SELECT comment.post_id, comment.id, comment.content, reddit_user.nickname 
        FROM comment 
        left join reddit_user on comment.user_id = reddit_user.id 
        WHERE content = '${content}' AND user_id = ${userId} AND post_id = ${postId}
        order by id desc
        `
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    res(comment.rows[0]);
  });
};

const subredditEdit = (data) => {
  return new Promise(async (res, rej) => {
    const { user, subredditId, description } = data;
    const privileged = await pool
      .query(
        `SELECT * FROM subreddit_moderator 
        INNER JOIN subreddit ON subreddit_moderator.subreddit_id = subreddit.id 
        WHERE subreddit_moderator.user_id = ${user} AND subreddit.name ='${subredditId}'`
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    if (privileged.rows.length === 0) {
      rej("Not priveleged.");
      return;
    }
    await pool
      .query(
        `UPDATE subreddit SET description = '${description}' WHERE name = '${subredditId}'`
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    res(true);
  });
};

const deletePost = (data) => {
  return new Promise(async (res, rej) => {
    const { user, subredditName, id } = data;
    const isModerator = await pool
      .query(
        `SELECT * FROM subreddit_moderator 
        INNER JOIN subreddit ON subreddit_moderator.subreddit_id = subreddit.id 
        WHERE user_id = ${user.id} AND subreddit.name = '${subredditName}'`
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    if (isModerator.rows.length === 0) {
      rej("Not a moderator.");
      return;
    }
    await pool
      .query(
        `
        delete from post_vote where post_id = ${id};
        delete from comment where post_id = ${id};
        DELETE FROM post WHERE id = ${id}`
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    res(true);
  });
};

const deleteComment = (data) => {
  return new Promise(async (res, rej) => {
    const { user, id, subredditName } = data;
    const isModerator = await pool
      .query(
        `SELECT * FROM subreddit_moderator 
      INNER JOIN subreddit ON subreddit_moderator.subreddit_id = subreddit.id 
      WHERE user_id = ${user.id} AND subreddit.name = '${subredditName}'`
      )
      .catch(() => {
        rej(`Couldn't connect to the database.`);
        return;
      });
    if (isModerator.rows.length === 0) {
      rej("Not a moderator.");
      return;
    }
    await pool.query(`delete from comment where id = ${id}`).catch(() => {
      rej(`Couldn't connect to the database.`);
      return;
    });
    res(true);
  });
};

module.exports = {
  pool,
  getUserById,
  getUserByName,
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
  joinSubreddit,
  getLanding,
  getSearch,
  getPost,
  addComment,
  subredditEdit,
  deletePost,
  deleteComment,
};
