require("dotenv").config();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const atob = require("atob");
const { parallel } = require("async");
const redis = require('redis')
const Pool = require("pg").Pool;

const pool = new Pool({
  user: process.env.user,
  host: process.env.HOST,
  database: process.env.DB,
  password: process.env.PASSWORD,
  port: process.env.DB_PORT,
});

const client = redis.createClient(process.env.REDIS_PORT)

const createUser = (req, res) => {
  const { email, password } = req.body;
  console.log("Entering CreateUser");
  console.log("Request Method:" + req.method);
  pool.query(
    "SELECT * FROM userdet where EMAIL=$1",
    [email],
    async (err, result) => {
      if (err) throw err;
      if (result.rows.length != 0)
        return res.status(400).send("Email already exists");
      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(password, salt);
      pool.query(
        "INSERT INTO userdet (email,password) VALUES ($1,$2)",
        [email, hashPassword],
        (err, result) => {
          if (err) throw err;
          res.status(200).send(`User added `);
        }
      );
    }
  );
};

const getUserById = (req, res) => {
  const id = req.params.id;
  console.log("Entering getUserById");
  console.log("Request Method:" + req.method);
  pool.query("SELECT * FROM userdet WHERE id=$1", [id], (err, result) => {
    if (err) throw err;
    res.status(200).send(result);
  });
};

const loginByEmail = (req, res) => {
  const { email } = req.body;
  console.log("Entering loginByEmail");
  console.log("Request Method:" + req.method);
  pool.query(
    "SELECT * FROM userdet WHERE email=$1",
    [email],
    async (err, result) => {
      if (err) throw err;
      if (result.rows.length == 0)
        return res.status(400).send("Email doesnot exist");
      const validPass = await bcrypt.compare(
        req.body.password,
        result.rows[0].password
      );
      if (!validPass) return res.status(400).send("Invalid Password");

      const token = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET);
      //assign a token
      res.header("auth-token", token);
      res.status(200).send("logged in");
    }
  );
};

const changePassword = (req,res)=>{
  console.log('Entering changePassword')
  console.log('Request Method:' + req.method)
  const id = req.user.id
  const { oldPassword, newPassword } = req.body
  pool.query("SELECT * FROM userdet WHERE id=$1",[id],async (err,result)=>{
    if(err) throw(err)
    const validPass = await bcrypt.compare(oldPassword, result.rows[0].password)
    if(!validPass) return res.status(403).send("Invalid Password")
    else{
      const salt = await bcrypt.genSalt(10)
      const hashPassword = await bcrypt.hash(newPassword,salt)
      pool.query("UPDATE userdet SET password=$1 WHERE id=$2",[hashPassword,id],(err,result)=>{
        if(err) throw(err)
        res.status(200).send("Password Updated")
      })
    }
  })
}

// const updateProfile = (req,res)=>{
//     const { email, password } = req.body

// }

const sendRequest = (req, res) => {
  const sentby = req.user.id;
  console.log("Entering sendRequest");
  console.log("Request Method:"+ req.method)
  pool.query(
    "SELECT id FROM userdet WHERE email=$1",
    [req.body.email],
    async (err, result) => {
      var flag = 0;
      if (err) throw err;
      const receivedby = result.rows[0].id;
      await pool.query(
        "SELECT * FROM friends WHERE uid=$1 AND friendid=$2",
        [receivedby, sentby],
        (err, result) => {
          if (err) throw err;
          if (result.rows.length) {
            return res.status(400).send("Already friends");
          } else {
            pool.query(
              "SELECT * FROM friendrequests WHERE receivedby=$1 AND sentby=$2",
              [receivedby, sentby],
              (err, result) => {
                if (err) throw err;
                if (result.rows.length) {
                  return res.status(400).send("Request already sent");
                } else {
                  pool.query(
                    "SELECT email FROM userdet where id=$1",
                    [sentby],
                    (err, result) => {
                      if (err) throw err;
                      var sentby_email = result.rows[0].email;
                      pool.query(
                        "INSERT INTO friendrequests (sentby, receivedby,sentby_email) VALUES ($1,$2,$3)",
                        [sentby, receivedby, sentby_email],
                        (err, result) => {
                          if (err) throw err;
                          res
                            .status(200)
                            .send(`Friend Request sent to ${req.body.email}`);
                        }
                      );
                    }
                  );
                }
              }
            );
          }
        }
      );
    }
  );
};

const viewAllRequest = (req, res) => {
  console.log("Entering viewAllRequest");
  console.log("Request Method:" + req.method);
  const redisKey = req.user.id + 'viewRequest'
  client.get(redisKey,(err,result)=>{
    if(err) throw(err)
    if(result !==null) return res.status(200).send(JSON.parse(result))
    else{
      pool.query(
        "SELECT sentby,sentby_email FROM friendrequests WHERE receivedby=$1",
        [req.user.id],
        (err, result) => {
          if (err) throw err;
          client.setex(redisKey,3600,JSON.stringify(result.rows))
          res.status(200).send(result.rows);
        }
      );
    }
  })
};

const addOrRemoveRequest = async (req, res) => {
  const { status, id } = req.body;
  console.log("Entering addOrRemoveRequest");
  console.log("Request Method:" + req.method);
  pool.query(
    "SELECT * FROM friendrequests where sentby=$1",
    [id],
    (err, result) => {
      if (err) throw err;
      if (result.rows.length == 0)
        return res.status(400).send("Invalid Operation");
    }
  );
  if (status === "AC") {
    await pool.query(
      "INSERT INTO friends (uid,friendid) VALUES ($1,$2)",
      [req.user.id, id],
      (err, result) => {
        if (err) throw err;
      }
    );
    await pool.query(
      "INSERT INTO friends (uid,friendid) VALUES ($1,$2)",
      [id, req.user.id],
      (err, result) => {
        if (err) throw err;
      }
    );
    await pool.query(
      "DELETE FROM friendrequests WHERE sentby=$1",
      [id],
      (err, result) => {
        if (err) throw err;
      }
    );
    res.status(200).send("Friend Request accepted");
  } else {
    await pool.query(
      "DELETE FROM friendrequests WHERE sentby=$1",
      [id],
      (err, result) => {
        if (err) throw err;
      }
    );
    res.status(200).send("Friend Requested removed");
  }
};

const viewAllFriends = (req, res) => {
  console.log("Entering viewAllFriends");
  console.log("Request Method:" + req.method);
  const redisKey = req.user.id + 'viewAllFriends'
  client.get(redisKey,(err,result)=>{
    if(err) throw(err)
    if(result !==null ) return res.status(200).send(JSON.parse(result))
    else{
      pool.query(
        "SELECT * FROM friends WHERE uid=$1",
        [req.user.id],
        async (err, result) => {
          if (err) throw err;
          const friends = await Promise.all(
            result.rows.map(async (item) => {
              try {
                const result = await pool.query(
                  "SELECT email FROM userdet WHERE id=$1",
                  [item.friendid]
                );
                return result.rows[0].email;
              } catch (error) {
                throw error;
              }
            })
          );
          client.setex(redisKey,3600,JSON.stringify(friends))
          res.status(200).send(friends);
        }
      );
    }
  })
};

const viewFriendsOfFriends = (req, res) => {
  console.log("Entering viewFriendsOfFriends");
  console.log("Request Method:" + req.method);
  const friendEmail = req.body.email;

  pool.query(
    "SELECT id FROM userdet WHERE email=$1",
    [friendEmail],
    (err, result) => {
      if (err) throw err;
      var friendid = result.rows[0].id;
      pool.query(
        "SELECT * FROM friends WHERE uid=$1",
        [friendid],
        async (err, result) => {
          if (err) throw err;
          const friends = await Promise.all(
            result.rows.map(async (item) => {
              try {
                const result = await pool.query(
                  "SELECT email from userdet WHERE id=$1",
                  [item.friendid]
                );
                return result.rows[0].email;
              } catch (error) {
                throw error;
              }
            })
          );
          res.status(200).send(friends);
        }
      );
    }
  );
};

const viewMutualFriends = async (req, res) => {
  console.log("Entering viewMututalFriends");
  console.log("Request Method:" + req.method);
  const redisKey = req.user.id + 'viewMutualFriends'
  const { email } = req.body.email;
  const uid = req.user.id;
  client.get(redisKey,async (err,result)=>{
    if(err) throw(err)
    if(result!==null) return res.status(200).send(JSON.parse(result))
    else{
      const f = await pool.query("SELECT id FROM userdet WHERE email=$1", [email]);
      const fid = f.rows[0].id;
      const myfriends = await (
        await pool.query("SELECT friendid FROM friends WHERE uid=$1", [uid])
      ).rows;
      const queryFriends = await (
        await pool.query("SELECT friendid FROM friends WHERE uid=$1", [fid])
      ).rows;
      var mutualFriends = [];
      for (var i = 0; i < myfriends.length; i++) {
        for (var j = 0; j < queryFriends.length; j++) {
          if (myfriends[i].friendid === queryFriends[j].friendid)
            mutualFriends.push(myfriends[i].friendid);
        }
      }
      if (mutualFriends.length == 0)
        return res.status(200).send("No mutual friends");
      const mutualFriendList = await Promise.all(
        mutualFriends.map(async (item) => {
          try {
            const result = await pool.query(
              "SELECT email FROM userdet WHERE ID=$1",
              [item]
            );
            return result;
          } catch (error) {
            throw error;
          }
        })
      );
      client.setex(redis,3600,JSON.stringify(mutualFriendList))
      res.status(200).send(mutualFriendList);
    }
  })
};

const addPost = (req, res) => {
  console.log("Entering addPost");
  console.log("Request Method:" + req.method);
  const uid = req.user.id;
  const post = req.body.post;
  pool.query(
    "INSERT INTO posts (uid,post) VALUES ($1,$2)",
    [uid, post],
    (err, result) => {
      if (err) throw err;
      else {
        res.status(200).send("Post added");
      }
    }
  );
};

const viewPost = (req, res) => {
  console.log("Entering viewPost");
  console.log("Request Method:" + req.method);
  const redisKey = req.user.id + 'viewPost'
  const uid = req.user.id;
  client.get(redisKey, (err,result)=>{
    if(err) throw(err)
    if(result!==null) return res.status(200).send(JSON.parse(result))
    else{
      pool.query("SELECT post,id FROM posts WHERE uid=$1", [uid], (err, result) => {
        if (err) throw err;
        if (result.rows.length === 0) return res.status(200).send("No posts made");
        var posts = result.rows.map((item) => item.post);
        client.setex(redisKey,3600,JSON.stringify(result.rows))
        res.status(200).send(result.rows);
      });
    }
  })
};

const deletePost = (req, res) => {
  console.log("Entering deletePost");
  console.log("Request Method:" + req.method);
  const uid = req.user.id;
  pool.query("DELETE FROM posts WHERE id=$1", [req.body.id], (err, result) => {
    if (err) throw err;
    res.status(200).send("Post Deleted");
  });
};

module.exports = {
  createUser,
  getUserById,
  loginByEmail,
  changePassword,
  sendRequest,
  viewAllRequest,
  addOrRemoveRequest,
  viewAllFriends,
  viewFriendsOfFriends,
  viewMutualFriends,
  addPost,
  viewPost,
  deletePost
};
