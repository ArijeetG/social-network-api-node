const jwt = require("jsonwebtoken");
require('dotenv').config()

function auth(req, res, next) {
  console.log('Verifying Token')
  const token = req.header("auth-token");
  if (!token) return res.status(401).send("Access Denied");

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next()
  } catch (error) {
    res.status(400).send("Invalid Token");
  }
}
module.exports = auth