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
const { cleanupExpiredTournaments } = require('../controllers/cleanupController');

const verifyToken = require("../middleware/authMiddleware");
const optionalAuth = require("../middleware/optionalAuth");
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

// Отримати всі команди, які беруть участь у турнірі (з опціональною авторизацією)
router.get("/:tournamentId/teams", optionalAuth, getTournamentTeams);

// Отримати всіх користувачів, які зареєстровані в турнірі (з опціональною авторизацією)  
router.get("/:tournamentId/users", optionalAuth, getTournamentUsers);

// Отримати всі турніри, в яких бере участь команда
router.get("/teams/:teamId/tournaments", getTeamTournaments);

// Підтвердити готовність
router.post("/:tournamentId/ready", verifyToken, confirmReady);
// Відмінити готовність
router.delete("/:tournamentId/ready", verifyToken, cancelReady);

// Запустити турнір CS 1.6
router.post("/:id/start-cs16", verifyToken, isOrganizer, startCS16Tournament);

// Додайте цей маршрут
router.delete('/cleanup-expired', verifyToken, cleanupExpiredTournaments);

// Маршрут для ручного тестування очищення (тільки для адміністраторів)
router.post('/test-cleanup', verifyToken, async (req, res) => {
  // Перевіряємо чи користувач адміністратор
  if (req.user.role !== 2) {
    return res.status(403).json({ error: "Доступ заборонено" });
  }
  
  try {
    const { autoCleanupExpiredTournaments } = require('../controllers/cleanupController');
    const deleted = await autoCleanupExpiredTournaments();
    res.json({ 
      message: "Тестове очищення завершено", 
      deletedCount: deleted.length,
      deletedTournaments: deleted 
    });
  } catch (err) {
    console.error("Помилка тестового очищення:", err);
    res.status(500).json({ error: "Помилка сервера" });
  }
});

// Динамічний маршрут має бути останнім! (з опціональною авторизацією)
router.get("/:id", optionalAuth, getTournamentById);

module.exports = router;
