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

exports.tet = tet;
exports.pool = pool;
exports.getUserById = getUserById;
exports.createUser = createUser;
