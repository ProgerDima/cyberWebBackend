const pool = require("../config/db");

module.exports = async (req, res, next) => {
  // Перевірка наявності користувача в req.user
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { teamId } = req.params;
  const userId = req.user.userId;

  try {
    // Перевірка, чи є користувач капітаном команди
    const result = await pool.query(
      `SELECT 1 FROM team_members 
       WHERE team_id = $1 AND user_id = $2 AND is_captain = TRUE`,
      [teamId, userId]
    );
    
    if (!result.rows.length) {
      return res.status(403).json({ error: "Доступ заборонено: ви не капітан" });
    }
    
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Помилка сервера" });
  }
};
