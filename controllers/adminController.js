const pool = require("../config/db");

// Отримати всіх користувачів (з ролями і турнірами)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await pool.query(
      `SELECT id, username, role, created_at, is_blocked FROM users ORDER BY created_at DESC`
    );
    const usersWithTournaments = await Promise.all(
      (users.rows || []).map(async (user) => {
        const tournaments = await pool.query(
          `SELECT t.id, t.name
           FROM tournaments t
           JOIN tournament_teams tt ON tt.tournament_id = t.id
           JOIN team_members tm ON tm.team_id = tt.team_id
           WHERE tm.user_id = $1`,
          [user.id]
        );
        return {
          ...user,
          tournaments: tournaments.rows || [],
        };
      })
    );
    res.json(Array.isArray(usersWithTournaments) ? usersWithTournaments : []);
  } catch (err) {
    console.error('getAllUsers error:', err);
    res.status(500).json({ error: "DB error" });
  }
};

// Блокування користувача
exports.blockUser = async (req, res) => {
  const userId = req.params.userId;
  try {
    await pool.query(
      `UPDATE users SET is_blocked = TRUE WHERE id = $1`,
      [userId]
    );
    res.json({ message: "Користувача заблоковано" });
  } catch (err) {
    console.error('blockUser error:', err);
    res.status(500).json({ error: "DB error" });
  }
};

// Розблокування користувача
exports.unblockUser = async (req, res) => {
  const userId = req.params.userId;
  try {
    await pool.query(
      `UPDATE users SET is_blocked = FALSE WHERE id = $1`,
      [userId]
    );
    res.json({ message: "Користувача розблоковано" });
  } catch (err) {
    console.error('unblockUser error:', err);
    res.status(500).json({ error: "DB error" });
  }
};

// Зміна ролі користувача
exports.changeUserRole = async (req, res) => {
  const userId = req.params.userId;
  const { role } = req.body; // "admin", "moderator", "user"
  if (!["admin", "moderator", "user"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  try {
    await pool.query(
      `UPDATE users SET role = $1 WHERE id = $2`,
      [role, userId]
    );
    res.json({ message: "Роль оновлено" });
  } catch (err) {
    console.error('changeUserRole error:', err);
    res.status(500).json({ error: "DB error" });
  }
};

// Отримати всі команди (з учасниками)
exports.getAllTeams = async (req, res) => {
  try {
    const teams = await pool.query(
      `SELECT id, name as teamName, created_at FROM teams ORDER BY created_at DESC`
    );
    const teamsWithMembers = await Promise.all(
      (teams.rows || []).map(async (team) => {
        const members = await pool.query(
          `SELECT u.id, u.username as name, tm.role
           FROM team_members tm
           JOIN users u ON tm.user_id = u.id
           WHERE tm.team_id = $1`,
          [team.id]
        );
        return {
          ...team,
          members: members.rows || [],
        };
      })
    );
    res.json(Array.isArray(teamsWithMembers) ? teamsWithMembers : []);
  } catch (err) {
    console.error('getAllTeams error:', err);
    res.status(500).json({ error: "DB error" });
  }
};

// Видалити команду
exports.deleteTeam = async (req, res) => {
  const teamId = req.params.teamId;
  try {
    await pool.query(`DELETE FROM team_members WHERE team_id = $1`, [teamId]);
    await pool.query(`DELETE FROM teams WHERE id = $1`, [teamId]);
    res.json({ message: "Команду видалено" });
  } catch (err) {
    console.error('deleteTeam error:', err);
    res.status(500).json({ error: "DB error" });
  }
};

// Отримати всі турніри
exports.getAllTournaments = async (req, res) => {
  try {
    const tournaments = await pool.query(
      `SELECT id, name, discipline, created_by, created_at, status FROM tournaments ORDER BY created_at DESC`
    );
    res.json(Array.isArray(tournaments.rows) ? tournaments.rows : []);
  } catch (err) {
    console.error('getAllTournaments error:', err);
    res.status(500).json({ error: "DB error" });
  }
};

// Видалити турнір
exports.deleteTournament = async (req, res) => {
  const tournamentId = req.params.tournamentId;
  try {
    await pool.query(`DELETE FROM tournaments WHERE id = $1`, [tournamentId]);
    res.json({ message: "Турнір видалено" });
  } catch (err) {
    console.error('deleteTournament error:', err);
    res.status(500).json({ error: "DB error" });
  }
};