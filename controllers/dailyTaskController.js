const pool = require("../config/db");

// 1) Генеруємо щоденні завдання для користувача (наприклад, на сьогодні)
exports.generateTodayTasks = async (req, res) => {
  const userId = req.user.userId;
  const today = new Date().toISOString().slice(0,10);

  try {
    // Якщо вже згенеровано — повертаємо існуючі
    const existing = await pool.query(
      "SELECT * FROM daily_tasks WHERE user_id=$1 AND task_date=$2",
      [userId, today]
    );
    if (existing.rows.length) {
      return res.json(existing.rows);
    }

    // Інакше — створюємо 3 фіксовані таски
    const tasks = [
      "Привітатися з командою у чаті",
      "Підтягнути статистику останнього матчу",
      "Перевірити розклад турнірів на завтра"
    ];

    const inserts = await Promise.all(tasks.map(desc =>
      pool.query(
        `INSERT INTO daily_tasks (user_id, task_date, description)
         VALUES ($1,$2,$3) RETURNING *`,
        [userId, today, desc]
      ).then(r=>r.rows[0])
    ));

    res.status(201).json(inserts);
  } catch (err) {
    console.error("generateTodayTasks:", err);
    res.status(500).json({ error: "Помилка генерації завдань" });
  }
};

// 2) Отримати всі завдання користувача
exports.getMyTasks = async (req, res) => {
  const userId = req.user.userId;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM daily_tasks WHERE user_id=$1 ORDER BY task_date DESC",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error("getMyTasks:", err);
    res.status(500).json({ error: "Помилка отримання завдань" });
  }
};

// 3) Позначити завдання як виконане
exports.completeTask = async (req, res) => {
  const taskId = parseInt(req.params.id,10);
  const userId = req.user.userId;
  try {
    const result = await pool.query(
      `UPDATE daily_tasks
          SET is_completed = TRUE,
              completed_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2
        RETURNING *`,
      [taskId, userId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Завдання не знайдено" });
    }
    res.json({ message: "Завдання виконано", task: result.rows[0] });
  } catch (err) {
    console.error("completeTask:", err);
    res.status(500).json({ error: "Помилка оновлення завдання" });
  }
};

exports.getDailyTasks = async (req, res) => {
    const date = req.query.date;
    let query = "SELECT * FROM daily_tasks";
    const params = [];
  
    if (date) {
      query += " WHERE date = $1";
      params.push(date);
    }
  
    const { rows } = await pool.query(query, params);
    res.json(rows);
  };
  