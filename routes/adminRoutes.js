const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { cleanupExpiredTournaments } = require("../controllers/cleanupController");
const authMiddleware = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/isAdmin");

// Користувачі
router.get("/users", authMiddleware, isAdmin, adminController.getAllUsers);
router.post("/users/:userId/block", authMiddleware, isAdmin, adminController.blockUser);
router.post("/users/:userId/unblock", authMiddleware, isAdmin, adminController.unblockUser);
router.post("/users/:userId/role", authMiddleware, isAdmin, adminController.changeUserRole);
router.delete("/users/:userId", authMiddleware, isAdmin, adminController.deleteUser);

// Команди
router.get("/teams", authMiddleware, isAdmin, adminController.getAllTeams);
router.delete("/teams/:teamId", authMiddleware, isAdmin, adminController.deleteTeam);

// Турніри
router.get("/tournaments", authMiddleware, isAdmin, adminController.getAllTournaments);
router.delete("/tournaments/:tournamentId", authMiddleware, isAdmin, adminController.deleteTournament);

// Очищення застарілих турнірів
router.post("/cleanup-expired-tournaments", authMiddleware, isAdmin, cleanupExpiredTournaments);

module.exports = router;