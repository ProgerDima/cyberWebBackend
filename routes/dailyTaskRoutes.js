const express = require("express");
const {
  generateTodayTasks,
  getMyTasks,
  completeTask,
  getDailyTasks
} = require("../controllers/dailyTaskController");

const verifyToken = require("../middleware/authMiddleware");
const router = express.Router();

// Генерація/отримання тасків на сьогодні
router.post("/today", verifyToken, generateTodayTasks);

// Отримати всі свої таски
router.get("/", verifyToken, getMyTasks);
  
// Позначити конкретне завдання виконаним
router.patch("/:id/complete", verifyToken, completeTask);

// Отримати всі завдання (як окремий маршрут)
router.get("/all", verifyToken, getDailyTasks);

module.exports = router;
