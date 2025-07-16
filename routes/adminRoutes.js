const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const isAdmin = require("../middleware/isAdmin");

// Користувачі
router.get("/users", isAdmin, adminController.getAllUsers);
router.post("/users/:userId/block", isAdmin, adminController.blockUser);
router.post("/users/:userId/unblock", isAdmin, adminController.unblockUser);
router.post("/users/:userId/role", isAdmin, adminController.changeUserRole);

// Команди
router.get("/teams", isAdmin, adminController.getAllTeams);
router.delete("/teams/:teamId", isAdmin, adminController.deleteTeam);

// Турніри
router.get("/tournaments", isAdmin, adminController.getAllTournaments);
router.delete("/tournaments/:tournamentId", isAdmin, adminController.deleteTournament);

module.exports = router;