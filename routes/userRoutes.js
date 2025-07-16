const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { getUserProfile } = require("../controllers/userController");
const verifyToken = require("../middleware/authMiddleware");

router.get("/search", verifyToken, userController.searchUsers);
router.get("/:id", getUserProfile);

module.exports = router;