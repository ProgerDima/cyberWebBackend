const express = require("express");
const { setMatchResult, getMatchesByTournament, getMatchStats } = require("../controllers/matchController");
const verifyToken = require("../middleware/authMiddleware");
const isOrganizer = require("../middleware/isOrganizer");
const router = express.Router();

// Оновлення результату матчу
// Доступ лише організатору (потрібно перевірити role чи іншу авторизацію)
router.post("/:id/result", verifyToken, isOrganizer, setMatchResult);

// Отримання всіх матчів турніру
// Очікується, що :tid — це ID турніру
router.get("/tournament/:tid", verifyToken, getMatchesByTournament);

// Отримання статистики по конкретному матчу
// Використовується для отримання детальної статистики
router.get("/:id/stats", verifyToken, getMatchStats);

module.exports = router;
