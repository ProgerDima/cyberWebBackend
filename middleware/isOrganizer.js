const pool = require("../config/db");

module.exports = async (req, res, next) => {
  const userId = req.user.userId;
  const tournamentId = req.params.id;

  try {
    // Отримуємо власника турніру з бази
    const { rows } = await pool.query(
      "SELECT created_by FROM tournaments WHERE id = $1",
      [tournamentId]
    );
    
    // Якщо турнір не знайдено або користувач не є власником або адміністратором
    if (!rows || !rows.length || (rows[0].created_by !== userId && req.user.role !== 2)) {
      return res.status(403).json({ error: "Доступ заборонено" });
    }
    
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Помилка сервера" });
  }
};
