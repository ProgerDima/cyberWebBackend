const pool = require("../config/db");

// Отримати всі матчі турніру
exports.getMatchesByTournament = async (req, res) => {
  const tid = parseInt(req.params.tid, 10);
  if (isNaN(tid)) {
    return res.status(400).json({ error: "Невірний ID турніру" });
  }
  try {
    const { rows } = await pool.query(
      `SELECT * FROM matches
         WHERE tournament_id = $1
      ORDER BY round, scheduled_at`,
      [tid]
    );
    res.json(rows);
  } catch (err) {
    console.error("getMatchesByTournament error:", err);
    res.status(500).json({ error: "Помилка при отриманні матчів" });
  }
};

// Оновити результат матчу
exports.setMatchResult = async (req, res) => {
  const matchId = parseInt(req.params.id, 10);
  const { winner_id, result } = req.body;
  if (isNaN(matchId) || !winner_id || typeof result !== "object") {
    return res.status(400).json({ error: "Неправильні вхідні дані" });
  }

  try {
    const updateQuery = `
      UPDATE matches
         SET winner_id = $1,
             result = $2,
             status = 'finished'
       WHERE id = $3
   RETURNING id, tournament_id, round, winner_id, result, status;
    `;
    const { rows } = await pool.query(updateQuery, [winner_id, result, matchId]);
    if (!rows.length) {
      return res.status(404).json({ error: "Матч не знайдено" });
    }

    const { tournament_id, round } = rows[0];

    // Перевірка, чи всі матчі поточного раунду завершені
    const pendingRes = await pool.query(
      `SELECT COUNT(*) AS cnt
         FROM matches
        WHERE tournament_id = $1
          AND round = $2
          AND status <> 'finished'`,
      [tournament_id, round]
    );
    if (parseInt(pendingRes.rows[0].cnt, 10) === 0) {
      // Генеруємо наступний раунд
      await pool.query("SELECT generate_next_round($1)", [tournament_id]);
    }

    res.json({ message: "Результат матчу оновлено", match: rows[0] });
  } catch (err) {
    console.error("setMatchResult error:", err);
    res.status(500).json({ error: "Помилка при оновленні результату матчу" });
  }
};

// GET /matches/:id/stats
exports.getMatchStats = async (req, res) => {
    const matchId = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `SELECT ps.user_id, u.username, ps.kills, ps.deaths, ps.assists, ps.rating
         FROM player_stats ps
    LEFT JOIN users u ON ps.user_id = u.id
        WHERE ps.match_id = $1`,
      [matchId]
    );
    res.json(rows);
  };
  