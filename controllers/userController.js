const pool = require("../config/db");

exports.searchUsers = async (req, res) => {
  const query = req.query.query || "";
  if (!query) return res.json([]);
  try {
    const users = await pool.query(
      "SELECT id, username FROM users WHERE username ILIKE $1 LIMIT 10",
      [query + "%"]
    );
    res.json(users.rows);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
};

// Отримати профіль користувача за ID
exports.getUserProfile = async (req, res) => {
  const userId = req.params.id;
  try {
    // Отримати username
    const userQ = await pool.query("SELECT id, username FROM users WHERE id = $1", [userId]);
    if (userQ.rows.length === 0) return res.status(404).json({ error: "Користувача не знайдено" });

    // Створені команди (де is_captain = true)
    const createdTeamsQ = await pool.query(
      `SELECT t.id, t.name, true as is_captain
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1 AND tm.is_captain = true`,
      [userId]
    );

    // Команди, в яких учасник (is_captain = false)
    const joinedTeamsQ = await pool.query(
      `SELECT t.id, t.name, false as is_captain
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1 AND tm.is_captain = false`,
      [userId]
    );

    // Створені турніри
    const createdTournamentsQ = await pool.query(
      `SELECT id, name FROM tournaments WHERE created_by = $1`,
      [userId]
    );

    // Турніри, в яких бере участь (через команди)
    const joinedTournamentsQ = await pool.query(
      `SELECT DISTINCT t.id, t.name
       FROM tournaments t
       JOIN tournament_teams tt ON tt.tournament_id = t.id
       JOIN team_members tm ON tm.team_id = tt.team_id
       WHERE tm.user_id = $1`,
      [userId]
    );

    res.json({
      id: userQ.rows[0].id,
      username: userQ.rows[0].username,
      createdTeams: createdTeamsQ.rows,
      joinedTeams: joinedTeamsQ.rows,
      createdTournaments: createdTournamentsQ.rows,
      joinedTournaments: joinedTournamentsQ.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};