const router = require("express").Router();
const { addPost, viewPost, deletePost } = require("./utils/queries");

router.post("/addPost", addPost);
router.get("/viewPost", viewPost);
router.post("/deletePost", deletePost);

module.exports = router;
