const {
  sendRequest,
  viewAllRequest,
  addOrRemoveRequest,
  viewAllFriends,
  viewFriendsOfFriends,
  viewMutualFriends,
} = require("./utils/queries");
const router = require("express").Router();

router.post("/sendRequest", sendRequest);
router.get("/viewRequests", viewAllRequest);
router.post("/respondToRequest", addOrRemoveRequest);
router.get("/viewAllFriends", viewAllFriends);
router.post("/viewFriendsofFriends", viewFriendsOfFriends);
router.post("/viewMututalFriends", viewMutualFriends);

module.exports = router;
