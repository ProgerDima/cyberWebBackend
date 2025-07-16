const express = require("express");
const {
  getTournaments,
  getTournamentById, // додай цей імпорт
  createTournament,
  updateTournament,
  deleteTournament,
  generateFirstRound,
  generateNextRound,
  checkTournamentName,
  addTeamToTournament, // Додайте цей імпорт
  getTournamentTeams, // Додайте цей імпорт
  getTournamentUsers, // Додайте цей імпорт
  getTeamTournaments, // Додайте цей імпорт
  removeTeamFromTournament, // Додайте цей імпорт
  confirmReady, // додай цей імпорт
  cancelReady,   // додай цей імпорт
  startCS16Tournament // Додайте цей імпорт
} = require("../controllers/tournamentController");

const verifyToken = require("../middleware/authMiddleware");
const isOrganizer = require("../middleware/isOrganizer");
const router = express.Router();

// Публічний маршрут
router.get("/", getTournaments);

// Створити турнір
router.post("/", verifyToken, createTournament);

// Оновити турнір
router.put("/:id", verifyToken, isOrganizer, updateTournament);

// Видалити турнір
router.delete("/:id", verifyToken, isOrganizer, deleteTournament);

// Генерувати перший раунд
router.post("/:id/generate-first-round", verifyToken, isOrganizer, generateFirstRound);

// Генерувати наступний раунд
router.post("/:id/next-round", verifyToken, isOrganizer, generateNextRound);

// ДОДАЙ ЦЕ ПЕРЕД router.get("/:id", ...)
router.get("/check-name", checkTournamentName);

// Додати команду на турнір (тільки для капітана)
router.post("/:tournamentId/add-team", verifyToken, addTeamToTournament);

// Видалити команду з турніру (тільки для капітана)
router.post("/:tournamentId/remove-team", verifyToken, removeTeamFromTournament);

// Отримати всі команди, які беруть участь у турнірі
router.get("/:tournamentId/teams", verifyToken, getTournamentTeams);

// Отримати всіх користувачів, які зареєстровані в турнірі
router.get("/:tournamentId/users", verifyToken, getTournamentUsers);

// Отримати всі турніри, в яких бере участь команда
router.get("/teams/:teamId/tournaments", getTeamTournaments);

// Підтвердити готовність
router.post("/:tournamentId/ready", verifyToken, confirmReady);
// Відмінити готовність
router.delete("/:tournamentId/ready", verifyToken, cancelReady);

// Запустити турнір CS 1.6
router.post("/:id/start-cs16", verifyToken, isOrganizer, startCS16Tournament);

// Динамічний маршрут має бути останнім!
router.get("/:id", getTournamentById);

module.exports = router;
