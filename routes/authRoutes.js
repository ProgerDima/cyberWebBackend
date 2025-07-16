// routes/authRoutes.js
const express = require("express");
const {
  register,
  login,
  refreshToken,
  getUsers,
  updateProfile,
  blockUser,
  deleteUser,
  getProfile
} = require("../controllers/authController");

const verifyToken = require("../middleware/authMiddleware");
const optionalAuth = require("../middleware/optionalAuth");
const isAdmin     = require("../middleware/isAdmin");

const router = express.Router();

// Public
router.post("/register", register);
router.post("/login",    login);
router.post("/refresh",  refreshToken);   // <-- new refresh route

// Check authentication status (optional auth)
router.get("/check", optionalAuth, (req, res) => {
  res.json({
    isAuthenticated: !!req.user,
    user: req.user || null
  });
});

// Protected
router.get("/users", verifyToken, isAdmin, getUsers);
router.put("/profile", verifyToken, updateProfile);
router.get("/profile", verifyToken, getProfile);

// Admin-only
router.patch("/users/:id/block", verifyToken, isAdmin, blockUser);
router.delete("/users/:id",      verifyToken, isAdmin, deleteUser);

module.exports = router;
