const pool = require("../config/db");
const { spawn } = require("child_process");
const path = require("path");

// Отримати список турнірів
exports.getTournaments = async (req, res) => {
  const { status } = req.query;
  try {
    let query = `SELECT * FROM tournaments 
                 WHERE NOT (
                   (registration_end < NOW() OR registration_end IS NULL) 
                   AND status = 'запланований'
                 )`;
    const params = [];
    
    if (status) {
      query += " AND status = $1";
      params.push(status);
    }
    
    query += " ORDER BY created_at DESC";
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Створити турнір
exports.createTournament = async (req, res) => {
  const {
    name, format, rules, description,
    start_date, end_date, max_teams, status, players_per_team,
    ready_start, ready_end, registration_end // додано registration_end
  } = req.body;
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `INSERT INTO tournaments
         (name, format, rules, description, start_date, end_date, max_teams, created_by, status, players_per_team, ready_start, ready_end, registration_end)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [name, format, rules, description, start_date, end_date, max_teams, userId, status || "запланований", players_per_team, ready_start, ready_end, registration_end]
    );
    res.status(201).json({ message: "Tournament created", tournament: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Оновити турнір
exports.updateTournament = async (req, res) => {
  const { id } = req.params;
  const {
    name, format, rules, description,
    start_date, end_date, max_teams, status,
    ready_start, ready_end, registration_end // додано registration_end
  } = req.body;
  const userId = req.user.userId;

  const allowed = ["запланований", "активний", "завершений"];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid tournament status" });
  }

  try {
    // Перевірка чи користувач є організатором цього турніру або має роль адміністратора
    const { rows } = await pool.query("SELECT created_by, status FROM tournaments WHERE id = $1", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    // Перевірка доступу
    if (rows[0].created_by !== userId && req.user.role !== 2) {
      return res.status(403).json({ error: "You do not have permission to update this tournament" });
    }

    const result = await pool.query(
      `UPDATE tournaments
         SET name=$1, format=$2, rules=$3, description=$4,
             start_date=$5, end_date=$6, max_teams=$7, status=$8,
             ready_start=$9, ready_end=$10, registration_end=$11
       WHERE id=$12
       RETURNING *`,
      [name, format, rules, description, start_date, end_date, max_teams, status, ready_start, ready_end, registration_end, id]
    );

    res.json({ message: "Tournament updated", tournament: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Видалити турнір
exports.deleteTournament = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    // Перевірка чи користувач є організатором цього турніру або має роль адміністратора
    const { rows } = await pool.query("SELECT created_by FROM tournaments WHERE id = $1", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    // Перевірка доступу
    if (rows[0].created_by !== userId && req.user.role !== 2) {
      return res.status(403).json({ error: "You do not have permission to delete this tournament" });
    }

    const result = await pool.query("DELETE FROM tournaments WHERE id = $1 RETURNING id", [id]);
    res.json({ message: "Tournament deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Генерація стартового раунду
exports.generateFirstRound = async (req, res) => {
  const tournamentId = parseInt(req.params.id, 10);
  if (isNaN(tournamentId)) {
    return res.status(400).json({ error: "Невірний ID турніру" });
  }

  try {
    // Перевірка чи користувач є організатором цього турніру або має роль адміністратора
    const { rows } = await pool.query("SELECT created_by FROM tournaments WHERE id = $1", [tournamentId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    if (rows[0].created_by !== req.user.userId && req.user.role !== 2) {
      return res.status(403).json({ error: "You do not have permission to generate the first round" });
    }

    await pool.query("SELECT generate_matches($1)", [tournamentId]);
    res.json({ message: "Перший раунд згенеровано" });
  } catch (err) {
    console.error("generateFirstRound error:", err);
    res.status(500).json({ error: "Помилка при генерації першого раунду" });
  }
};

// Генерація наступного раунду
exports.generateNextRound = async (req, res) => {
  const tournamentId = parseInt(req.params.id, 10);
  if (isNaN(tournamentId)) {
    return res.status(400).json({ error: "Невірний ID турніру" });
  }

  try {
    // Перевірка чи користувач є організатором цього турніру або має роль адміністратора
    const { rows } = await pool.query("SELECT created_by FROM tournaments WHERE id = $1", [tournamentId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    if (rows[0].created_by !== req.user.userId && req.user.role !== 2) {
      return res.status(403).json({ error: "You do not have permission to generate the next round" });
    }

    await pool.query("SELECT generate_next_round($1)", [tournamentId]);
    res.json({ message: "Наступний раунд згенеровано" });
  } catch (err) {
    console.error("generateNextRound error:", err);
    res.status(500).json({ error: "Помилка при генерації наступного раунду" });
  }
};

// Отримати турнір за ID
exports.getTournamentById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM tournaments WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    // Додаємо інформацію про поточного користувача
    const tournament = {
      ...result.rows[0],
      currentUser: req.user ? {
        id: req.user.userId,
        isAuthenticated: true
      } : {
        isAuthenticated: false
      }
    };
    
    res.json(tournament);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Перевірка унікальності назви турніру
exports.checkTournamentName = async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ exists: false });
  try {
    const result = await pool.query("SELECT 1 FROM tournaments WHERE name = $1 LIMIT 1", [name]);
    res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ exists: false });
  }
};

// Додати команду на турнір
exports.addTeamToTournament = async (req, res) => {
  const tournamentId = parseInt(req.params.tournamentId, 10);
  const { teamId } = req.body;
  const userId = req.user.userId;

  try {
    // Перевірка чи користувач є капітаном цієї команди
    const isCaptain = await pool.query(
      `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 AND is_captain = TRUE`,
      [teamId, userId]
    );
    if (!isCaptain.rows.length) {
      return res.status(403).json({ error: "Тільки капітан може додати команду на турнір" });
    }

    // Перевірка чи вже додано
    const exists = await pool.query(
      `SELECT 1 FROM tournament_teams WHERE tournament_id = $1 AND team_id = $2`,
      [tournamentId, teamId]
    );
    if (exists.rows.length) {
      return res.status(400).json({ error: "Команда вже зареєстрована на цьому турнірі" });
    }

    // Додаємо команду
    await pool.query(
      `INSERT INTO tournament_teams (tournament_id, team_id, registered_at, disqualified) VALUES ($1, $2, NOW(), FALSE)`,
      [tournamentId, teamId]
    );

    res.json({ message: "Команду додано на турнір" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Помилка сервера" });
  }
};

// Отримати всі команди, які беруть участь у турнірі
exports.getTournamentTeams = async (req, res) => {
  const tournamentId = parseInt(req.params.tournamentId, 10);
  if (isNaN(tournamentId)) {
    return res.status(400).json({ error: "Невірний ID турніру" });
  }
  try {
    // Отримати всі команди турніру разом із confirmed_players
    const result = await pool.query(
      `SELECT t.id, t.name, t.discipline, tt.confirmed_players
       FROM tournament_teams tt
       JOIN teams t ON tt.team_id = t.id
       WHERE tt.tournament_id = $1 AND tt.disqualified = FALSE`,
      [tournamentId]
    );

    // Для кожної команди отримати memberss
    const teamsWithMembers = await Promise.all(result.rows.map(async (team) => {
      const membersRes = await pool.query(
        `SELECT u.id, u.username, tm.is_captain
         FROM team_members tm
         JOIN users u ON tm.user_id = u.id
         WHERE tm.team_id = $1`,
        [team.id]
      );
      return {
        ...team,
        members: membersRes.rows.map(m => ({
          id: m.id,
          name: m.username,
          is_captain: m.is_captain
        })),
        confirmed_players: team.confirmed_players || []
      };
    }));

    res.json(teamsWithMembers);
  } catch (err) {
    console.error('Помилка отримання команд турніру:', err);
    res.status(500).json({ error: "Помилка сервера" });
  }
};

// Отримати всіх користувачів, які зареєстровані в турнірі
exports.getTournamentUsers = async (req, res) => {
  const tournamentId = parseInt(req.params.tournamentId, 10);
  if (isNaN(tournamentId)) {
    return res.status(400).json({ error: "Невірний ID турніру" });
  }
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, tm.team_id
       FROM tournament_teams tt
       JOIN team_members tm ON tt.team_id = tm.team_id
       JOIN users u ON tm.user_id = u.id
       WHERE tt.tournament_id = $1 AND tt.disqualified = FALSE`,
      [tournamentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Помилка отримання користувачів турніру:', err);
    res.status(500).json({ error: "Помилка сервера" });
  }
};

// Отримати всі турніри, в яких бере участь команда
exports.getTeamTournaments = async (req, res) => {
  const { teamId } = req.params;
  try {
    const result = await pool.query(
      `SELECT t.id, t.name, t.status, t.start_date, t.players_per_team
       FROM tournaments t
       JOIN tournament_teams tt ON tt.tournament_id = t.id
       WHERE tt.team_id = $1
       ORDER BY t.start_date DESC`,
      [teamId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Помилка отримання турнірів команди:', err);
    res.status(500).json({ error: "Server error" });
  }
};

// Видалити команду з турніру
exports.removeTeamFromTournament = async (req, res) => {
  const tournamentId = parseInt(req.params.tournamentId, 10);
  const { teamId } = req.body;
  const userId = req.user.userId;

  if (isNaN(tournamentId) || !teamId) {
    return res.status(400).json({ error: "Некоректний запит" });
  }

  try {
    // Перевірка: чи користувач є капітаном цієї команди
    const isCaptain = await pool.query(
      `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 AND is_captain = TRUE`,
      [teamId, userId]
    );
    if (!isCaptain.rows.length) {
      return res.status(403).json({ error: "Тільки капітан може видалити команду з турніру" });
    }

    // Видалити команду з турніру
    await pool.query(
      `DELETE FROM tournament_teams WHERE tournament_id = $1 AND team_id = $2`,
      [tournamentId, teamId]
    );

    res.json({ message: "Команду видалено з турніру" });
  } catch (err) {
    console.error("Помилка при видаленні команди з турніру:", err);
    res.status(500).json({ error: "Помилка сервера" });
  }
};

// Підтвердити готовність
exports.confirmReady = async (req, res) => {
  const tournamentId = parseInt(req.params.tournamentId, 10);
  const userId = req.user.userId;

  // Знайти команду користувача у цьому турнірі
  const teamRes = await pool.query(
    `SELECT tt.team_id FROM tournament_teams tt
     JOIN team_members tm ON tt.team_id = tm.team_id
     WHERE tt.tournament_id = $1 AND tm.user_id = $2`,
    [tournamentId, userId]
  );
  if (!teamRes.rows.length) return res.status(404).json({ error: "Ви не в команді цього турніру" });

  const teamId = teamRes.rows[0].team_id;

  // Додати userId у confirmed_players (якщо ще нема)
  await pool.query(
    `UPDATE tournament_teams
     SET confirmed_players = array_append(confirmed_players, $1)
     WHERE tournament_id = $2 AND team_id = $3 AND NOT confirmed_players @> ARRAY[$1]::integer[]`,
    [userId, tournamentId, teamId]
  );

  res.json({ message: "Готовність підтверджено" });
};

// Відмінити готовність
exports.cancelReady = async (req, res) => {
  const tournamentId = parseInt(req.params.tournamentId, 10);
  const userId = req.user.userId;

  // Знайти команду користувача у цьому турнірі
  const teamRes = await pool.query(
    `SELECT tt.team_id FROM tournament_teams tt
     JOIN team_members tm ON tt.team_id = tm.team_id
     WHERE tt.tournament_id = $1 AND tm.user_id = $2`,
    [tournamentId, userId]
  );
  if (!teamRes.rows.length) return res.status(404).json({ error: "Ви не в команді цього турніру" });

  const teamId = teamRes.rows[0].team_id;

  // Видалити userId з confirmed_players
  await pool.query(
    `UPDATE tournament_teams
     SET confirmed_players = array_remove(confirmed_players, $1)
     WHERE tournament_id = $2 AND team_id = $3`,
    [userId, tournamentId, teamId]
  );

  res.json({ message: "Готовність скасовано" });
};

// Додати цей метод у exports:
exports.startCS16Tournament = async (req, res) => {
  const tournamentId = parseInt(req.params.id, 10);
  // 1. Отримати всі команди турніру
  const teamsRes = await pool.query(
    `SELECT team_id FROM tournament_teams WHERE tournament_id = $1 AND disqualified = FALSE`,
    [tournamentId]
  );
  const teamIds = teamsRes.rows.map(r => r.team_id);

  // 2. Перемішати команди та створити пари
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  const shuffled = shuffle([...teamIds]);
  const pairs = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (shuffled[i + 1]) pairs.push([shuffled[i], shuffled[i + 1]]);
  }

  // 3. Для кожної пари — запускати сервер
  const maps = ["de_dust2", "de_inferno", "de_nuke", "de_train", "de_mirage"];
  const servers = [];
  let basePort = 27015;
  for (const [teamA, teamB] of pairs) {
    const map = maps[Math.floor(Math.random() * maps.length)];
    const port = basePort++;
    const password = Math.random().toString(36).substring(2, 8);

    // Тут запускаємо сервер через скрипт (приклад для Linux)
    const serverProcess = spawn(
      "/path/to/hlds_run", // заміни на реальний шлях до HLDS
      [
        "-game", "cstrike",
        "+map", map,
        "+sv_password", password,
        "-port", port,
        "+maxplayers", "10"
      ],
      { detached: true }
    );

    // Зберігаємо info (можна в БД)
    servers.push({
      teamA, teamB, map, port, password,
      pid: serverProcess.pid
    });
  }

  // 4. Зберегти інформацію про сервери у БД (створи таблицю matches або servers)
  // ...тут твоя логіка...

  res.json({ message: "Сервери створено", servers });
};

