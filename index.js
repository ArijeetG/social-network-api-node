const express = require("express");
const bodyparser = require("body-parser");
require("dotenv").config();

const authRoute = require("./routes/auth");
const socialRoute = require("./routes/social");
const postRoute = require("./routes/posts");
const db = require("./routes/utils/queries");
const auth = require("./routes/verifyToken");

const app = express();
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));

app.use("/auth", authRoute);
app.use("/social", auth, socialRoute);
app.use("/post", auth, postRoute);

app.listen(process.env.PORT, () =>
  console.log(`Listening in port: ${process.env.PORT}`)
);
