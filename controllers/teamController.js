const pool = require("../config/db");

// Створення команди
exports.createTeam = async (req, res) => {
    const { name, discipline, is_private } = req.body; // Додано is_private
    const captainId = req.user.userId;
  
    try {
        // Перевірка чи заблокований користувач
        const user = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [captainId]);
        if (user.rows[0].is_blocked) {
            return res.status(403).json({ error: "Заблоковані користувачі не можуть створювати команди" });
        }

        // Валідація даних
        if (!name || name.length < 3 || name.length > 50) {
            return res.status(400).json({ error: "Назва команди повинна містити від 3 до 50 символів" });
        }

        const validDisciplines = ['CS1.6'];
        if (!validDisciplines.includes(discipline)) {
            return res.status(400).json({ error: "Невірна дисципліна" });
        }

        // Створення команди з is_private
        const teamResult = await pool.query(
            `INSERT INTO teams (name, discipline, created_by, is_private) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`, 
            [name, discipline, captainId, is_private]
        );

        // Додавання капітана
        await pool.query(
            `INSERT INTO team_members (team_id, user_id, is_captain) 
             VALUES ($1, $2, TRUE)`, 
            [teamResult.rows[0].id, captainId]
        );

        res.status(201).json(teamResult.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка сервера" });
    }
};

// Додавання гравця до команди
exports.addMember = async (req, res) => {
    const { teamId } = req.params;
    const { userId } = req.body;
    const captainId = req.user.userId;

    try {
        // Перевірка прав капітана
        const isCaptain = await pool.query(
            `SELECT 1 FROM team_members 
             WHERE team_id = $1 AND user_id = $2 AND is_captain = TRUE`,
            [teamId, captainId]
        );
        if (!isCaptain.rows.length) {
            return res.status(403).json({ error: "Тільки капітан може додавати учасників" });
        }

        // Перевірка максимальної кількості для турніру
        const tournaments = await pool.query(
            `SELECT t.players_per_team
             FROM tournaments t
             JOIN tournament_teams tt ON tt.tournament_id = t.id
             WHERE tt.team_id = $1`,
            [teamId]
        );
        if (tournaments.rows.length) {
            const maxPlayers = Math.max(...tournaments.rows.map(t => t.players_per_team));
            const membersCount = await pool.query("SELECT COUNT(*) FROM team_members WHERE team_id = $1", [teamId]);
            if (parseInt(membersCount.rows[0].count) >= maxPlayers) {
                return res.status(400).json({ error: "Команда вже заповнена для турніру" });
            }
        } else {
            // Перевірка максимальної кількості (5 гравців)
            const membersCount = await pool.query(
                `SELECT COUNT(*) FROM team_members WHERE team_id = $1`,
                [teamId]
            );
            if (membersCount.rows[0].count >= 5) {
                return res.status(400).json({ error: "Команда вже заповнена (максимум 5 гравців)" });
            }
        }

        // Перевірка чи гравець вже в команді
        const existingMember = await pool.query(
            `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2`,
            [teamId, userId]
        );
        if (existingMember.rows.length > 0) {
            return res.status(400).json({ error: "Гравець вже є в цій команді" });
        }

        // Додавання учасника
        await pool.query(
            `INSERT INTO team_members (team_id, user_id)
             VALUES ($1, $2)`,
            [teamId, userId]
        );

        res.json({ message: "Учасника успішно додано" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка сервера" });
    }
};

// Отримання інформації про команду
exports.getTeamDetails = async (req, res) => {
    const { id } = req.params;
    
    try {
        const teamInfo = await pool.query(
            `SELECT * FROM teams WHERE id = $1`,
            [id]
        );
        
        if (!teamInfo.rows.length) {
            return res.status(404).json({ error: "Команду не знайдено" });
        }
        
        const members = await pool.query(
            `SELECT users.id, users.username 
             FROM team_members
             JOIN users ON team_members.user_id = users.id
             WHERE team_id = $1`,
            [id]
        );

        res.json({
            ...teamInfo.rows[0],
            members: members.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка сервера" });
    }
};

// Приєднання до команди
exports.joinTeam = async (req, res) => {
    const { teamId } = req.params;
    const userId = req.user.userId;

    try {
        // Перевірка існування команди
        const teamExists = await pool.query("SELECT 1 FROM teams WHERE id = $1", [teamId]);
        if (!teamExists.rows.length) {
            return res.status(404).json({ error: "Команду не знайдено" });
        }

        // Перевірка блокування користувача
        const user = await pool.query("SELECT is_blocked FROM users WHERE id = $1", [userId]);
        if (user.rows[0].is_blocked) {
            return res.status(403).json({ error: "Заблоковані користувачі не можуть приєднуватися до команд" });
        }

        // Перевірка участі у командах одного турніру
        const teamTournamentsResult = await pool.query(
            "SELECT tournament_id FROM tournament_teams WHERE team_id = $1",
            [teamId]
        );
        const teamTournaments = teamTournamentsResult.rows.map(row => row.tournament_id);

        if (teamTournaments.length > 0) {
            const conflict = await pool.query(
                `SELECT 1
                 FROM team_members tm
                 JOIN tournament_teams tt ON tm.team_id = tt.team_id
                 WHERE tm.user_id = $1 AND tt.tournament_id = ANY($2::int[])`,
                [userId, teamTournaments]
            );
            if (conflict.rows.length > 0) {
                return res.status(400).json({ error: "Ви вже берете участь у цьому турнірі в іншій команді" });
            }
            // Перевірка максимальної кількості для турніру
            const tournaments = await pool.query(
                `SELECT t.players_per_team
                 FROM tournaments t
                 JOIN tournament_teams tt ON tt.tournament_id = t.id
                 WHERE tt.team_id = $1`,
                [teamId]
            );
            if (tournaments.rows.length) {
                const maxPlayers = Math.max(...tournaments.rows.map(t => t.players_per_team));
                const membersCount = await pool.query("SELECT COUNT(*) FROM team_members WHERE team_id = $1", [teamId]);
                if (parseInt(membersCount.rows[0].count) >= maxPlayers) {
                    return res.status(400).json({ error: "Команда вже заповнена для турніру" });
                }
            }
        }

        // Перевірка, чи вже є у цій команді
        const alreadyMember = await pool.query(
            "SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2",
            [teamId, userId]
        );
        if (alreadyMember.rows.length > 0) {
            return res.status(400).json({ error: "Ви вже є учасником цієї команди" });
        }

        // Перевірка на максимальну кількість гравців (якщо не в турнірі)
        const membersCount = await pool.query("SELECT COUNT(*) FROM team_members WHERE team_id = $1", [teamId]);
        if (parseInt(membersCount.rows[0].count) >= 5) {
            return res.status(400).json({ error: "Команда вже заповнена (максимум 5 гравців)" });
        }

        // Додаємо користувача до команди
        await pool.query("INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)", [teamId, userId]);

        res.json({ message: "Ви успішно приєдналися до команди" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка сервера" });
    }
};
  
// Отримання рейтингу команди
exports.getTeamRating = async (req, res) => {
    const teamId = parseInt(req.params.id, 10);
    
    try {
        const { rows } = await pool.query(
            "SELECT rating, updated_at FROM team_ratings WHERE team_id = $1",
            [teamId]
        );
        
        if (!rows.length) {
            return res.status(404).json({ error: "Команду не знайдено" });
        }
        
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка сервера" });
    }
};

// Отримання профілю команди
exports.getTeamProfile = async (req, res) => {
    const teamId = parseInt(req.params.id, 10);

    try {
        // Основна інформація про команду
        const teamQ = await pool.query(
            `SELECT name, discipline
             FROM teams
             WHERE id = $1`,
            [teamId]
        );
        
        if (!teamQ.rows.length) {
            return res.status(404).json({ error: 'Команду не знайдено' });
        }
        
        const { name: teamName, discipline } = teamQ.rows[0];

        // Статистика перемог/поразок
        const winsQ = await pool.query(
            `SELECT COUNT(*) AS wins
             FROM matches
             WHERE winner_id = $1`,
            [teamId]
        );
        
        const playedQ = await pool.query(
            `SELECT COUNT(*) AS played
             FROM matches
             WHERE team1_id = $1 OR team2_id = $1`,
            [teamId]
        );
        
        const wins = +winsQ.rows[0].wins;
        const played = +playedQ.rows[0].played;
        const losses = played - wins;
        const winRate = played ? Math.round((wins/played)*100) : 0;

        // Рейтинг команди
        const ratingQ = await pool.query(
            `SELECT rating
             FROM team_ratings
             WHERE team_id = $1
             ORDER BY updated_at DESC
             LIMIT 1`,
            [teamId]
        );
        
        const rating = ratingQ.rows.length ? +ratingQ.rows[0].rating : null;

        // Склад команди
        const membersQ = await pool.query(
            `SELECT u.id, u.username, tm.is_captain, tm.position
             FROM team_members tm
             JOIN users u ON tm.user_id = u.id
             WHERE tm.team_id = $1
             ORDER BY tm.is_captain DESC, u.username`,
            [teamId]
        );
        
        const members = membersQ.rows.map(m => ({
            id: m.id,
            name: m.username,
            role: m.is_captain ? 'Капітан' : m.position || 'Гравець',
            initial: m.username.charAt(0).toUpperCase()
        }));

        res.json({
            teamId,
            teamName,
            discipline,
            rating,
            wins,
            losses,
            winRate,
            members
        });

    } catch (err) {
        console.error('Помилка отримання профілю команди:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
};

// Отримання всіх команд
exports.getAllTeams = async (req, res) => {
  try {
    // Додаємо is_private у SELECT
    const teams = await pool.query(`
      SELECT id, name, discipline, is_private, created_by
      FROM teams
      ORDER BY name
    `);

    // Для кожної команди отримуємо детальну інформацію
    const teamsWithDetails = await Promise.all(
      teams.rows.map(async (team) => {
        const teamId = team.id;

        // Статистика матчів
        const [wins, matches] = await Promise.all([
          pool.query(`SELECT COUNT(*) FROM matches WHERE winner_id = $1`, [teamId]),
          pool.query(`SELECT COUNT(*) FROM matches WHERE team1_id = $1 OR team2_id = $1`, [teamId])
        ]);

        const winsCount = parseInt(wins.rows[0].count);
        const matchesCount = parseInt(matches.rows[0].count);
        const lossesCount = matchesCount - winsCount;
        const winRate = matchesCount > 0 ? Math.round((winsCount / matchesCount) * 100) : 0;

        // Рейтинг
        const ratingResult = await pool.query(
          `SELECT rating FROM team_ratings 
           WHERE team_id = $1 ORDER BY updated_at DESC LIMIT 1`,
          [teamId]
        );
        const rating = ratingResult.rows[0]?.rating || 1000;

        // Учасники команди
        const membersResult = await pool.query(
          `SELECT u.id, u.username, tm.is_captain, tm.position
           FROM team_members tm
           JOIN users u ON tm.user_id = u.id
           WHERE tm.team_id = $1
           ORDER BY tm.is_captain DESC, u.username`,
          [teamId]
        );

        const members = membersResult.rows.map(member => ({
          id: member.id,
          name: member.username,
          role: member.is_captain ? 'Капітан' : member.position || 'Гравець',
          initial: member.username.charAt(0).toUpperCase()
        }));

        // Замість return { ... } у teamsWithDetails.map додайте:
        const tournamentsResult = await pool.query(
          `SELECT t.id, t.name, t.players_per_team
           FROM tournaments t
           JOIN tournament_teams tt ON tt.tournament_id = t.id
           WHERE tt.team_id = $1`,
          [teamId]
        );
        const tournaments = tournamentsResult.rows;

        return {
          teamId: team.id,
          teamName: team.name,
          discipline: team.discipline,
          is_private: team.is_private,
          created_by: team.created_by,
          rating: rating,
          wins: winsCount,
          losses: lossesCount,
          winRate: winRate,
          members: members,
          tournaments // ← Додаємо турніри з players_per_team!
        };
      })
    );

    res.json(teamsWithDetails);

  } catch (err) {
    console.error('Помилка отримання списку команд:', err);
    res.status(500).json({ 
      error: 'Внутрішня помилка сервера' 
    });
  }
};

// Отримати всі команди, де користувач є учасником або капітаном
exports.getUserTeams = async (req, res) => {
  const userId = req.user.userId;
  try {
    const teams = await pool.query(
      `SELECT t.id, t.name, t.discipline, tm.is_captain
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.user_id = $1`,
      [userId]
    );
    res.json(teams.rows);
  } catch (err) {
    console.error('Помилка отримання команд користувача:', err);
    res.status(500).json({ error: "Помилка сервера" });
  }
};

// Отримати всі команди, де користувач є капітаном
exports.getCaptainTeams = async (req, res) => {
  const userId = req.user.userId;
  const { tournamentId } = req.query; // tournamentId передається як query-параметр

  try {
    let query = `
      SELECT t.id, t.name, t.discipline, COUNT(tm2.user_id) AS members_count
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      LEFT JOIN team_members tm2 ON tm2.team_id = t.id
      WHERE tm.user_id = $1 AND tm.is_captain = TRUE
    `;
    const params = [userId];

    // Якщо передано tournamentId, показати лише ті команди, які ще НЕ додані на цей турнір
    // і не перевищують players_per_team по кількості учасників
    if (tournamentId) {
      query += `
        AND t.id NOT IN (
          SELECT team_id FROM tournament_teams WHERE tournament_id = $2
        )
        GROUP BY t.id, t.name, t.discipline
        HAVING COUNT(tm2.user_id) <= (
          SELECT players_per_team FROM tournaments WHERE id = $2
        )
      `;
      params.push(tournamentId);
    } else {
      query += ` GROUP BY t.id, t.name, t.discipline`;
    }

    console.log('getCaptainTeams query:', query);
    console.log('getCaptainTeams params:', params);

    const teams = await pool.query(query, params);
    
    console.log('getCaptainTeams result:', teams.rows);
    
    res.json(teams.rows);
  } catch (err) {
    console.error('Помилка отримання команд капітана:', err);
    res.status(500).json({ error: "Помилка сервера" });
  }
};

// Надіслати інвайт користувачу
exports.inviteUser = async (req, res) => {
    const { teamId } = req.params;
    const { toUserId } = req.body;
    const fromUserId = req.user.userId;
    try {
        // Перевірити, чи вже в команді
        const memberQ = await pool.query(
            `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2`,
            [teamId, toUserId]
        );
        if (memberQ.rows.length) return res.status(400).json({ error: "Користувач вже в цій команді" });

        // Перевірити, чи вже є активний інвайт
        const exists = await pool.query(
            `SELECT 1 FROM invites WHERE team_id = $1 AND to_user_id = $2 AND status = 'pending'`,
            [teamId, toUserId]
        );
        if (exists.rows.length) return res.status(400).json({ error: "Запрошення вже надіслано" });

        // Перевірка максимальної кількості для турніру
        const tournaments = await pool.query(
            `SELECT t.players_per_team
             FROM tournaments t
             JOIN tournament_teams tt ON tt.tournament_id = t.id
             WHERE tt.team_id = $1`,
            [teamId]
        );
        if (tournaments.rows.length) {
            const maxPlayers = Math.max(...tournaments.rows.map(t => t.players_per_team));
            const membersCount = await pool.query("SELECT COUNT(*) FROM team_members WHERE team_id = $1", [teamId]);
            if (parseInt(membersCount.rows[0].count) >= maxPlayers) {
                return res.status(400).json({ error: "Команда вже заповнена для турніру" });
            }
        } else {
            // Перевірка максимальної кількості (5 гравців)
            const membersCount = await pool.query(
                `SELECT COUNT(*) FROM team_members WHERE team_id = $1`,
                [teamId]
            );
            if (membersCount.rows[0].count >= 5) {
                return res.status(400).json({ error: "Команда вже заповнена (максимум 5 гравців)" });
            }
        }

        await pool.query(
            `INSERT INTO invites (team_id, from_user_id, to_user_id) VALUES ($1, $2, $3)`,
            [teamId, fromUserId, toUserId]
        );
        res.json({ message: "Інвайт надіслано" });
    } catch (err) {
        res.status(500).json({ error: "Помилка сервера" });
    }
};

// Отримати всі інвайти користувача
exports.getUserInvites = async (req, res) => {
  const userId = req.user.userId;
  try {
    const invites = await pool.query(
      `SELECT i.id, i.team_id, t.name as team_name, i.from_user_id, u.username as from_username, i.status
       FROM invites i
       JOIN teams t ON i.team_id = t.id
       JOIN users u ON i.from_user_id = u.id
       WHERE i.to_user_id = $1 AND i.status = 'pending'`,
      [userId]
    );
    res.json(invites.rows);
  } catch (err) {
    res.status(500).json({ error: "Помилка сервера" });
  }
};

// Прийняти інвайт
exports.acceptInvite = async (req, res) => {
  const { inviteId } = req.params;
  const userId = req.user.userId;
  try {
    // Знайти інвайт
    const inviteQ = await pool.query(
      `SELECT * FROM invites WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [inviteId, userId]
    );
    if (!inviteQ.rows.length) return res.status(404).json({ error: "Інвайт не знайдено" });
    const { team_id } = inviteQ.rows[0];

    // Перевірити, чи вже в команді
    const memberQ = await pool.query(
      `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [team_id, userId]
    );
    if (memberQ.rows.length) return res.status(400).json({ error: "Ви вже в цій команді" });

    // Додати в команду
    await pool.query(
      `INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)`,
      [team_id, userId]
    );
    // Оновити статус інвайта
    await pool.query(
      `UPDATE invites SET status = 'accepted' WHERE id = $1`,
      [inviteId]
    );
    // Видалити/деактивувати всі інші інвайти для цього користувача
    await pool.query(
      `UPDATE invites SET status = 'declined' WHERE to_user_id = $1 AND team_id != $2`,
      [userId, team_id]
    );
    res.json({ message: "Ви приєдналися до команди" });
  } catch (err) {
    res.status(500).json({ error: "Помилка сервера" });
  }
};

// Відхилити інвайт
exports.declineInvite = async (req, res) => {
  const { inviteId } = req.params;
  const userId = req.user.userId;
  try {
    await pool.query(
      `UPDATE invites SET status = 'declined' WHERE id = $1 AND to_user_id = $2`,
      [inviteId, userId]
    );
    res.json({ message: "Інвайт відхилено" });
  } catch (err) {
    res.status(500).json({ error: "Помилка сервера" });
  }
};

// Вихід з команди
exports.leaveTeam = async (req, res) => {
    const { teamId } = req.params;
    const userId = req.user.userId;

    try {
        // Перевірка чи користувач є учасником
        const member = await pool.query(
            "SELECT is_captain FROM team_members WHERE team_id = $1 AND user_id = $2",
            [teamId, userId]
        );
        if (!member.rows.length) {
            return res.status(400).json({ error: "Ви не є учасником цієї команди" });
        }
        // Не дозволяти капітану просто вийти (можна додати окрему логіку)
        if (member.rows[0].is_captain) {
            return res.status(400).json({ error: "Капітан не може покинути команду напряму" });
        }
        // Видалити користувача з команди
        await pool.query(
            "DELETE FROM team_members WHERE team_id = $1 AND user_id = $2",
            [teamId, userId]
        );
        res.json({ message: "Ви вийшли з команди" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка сервера" });
    }
};

// Видалення команди
exports.deleteTeam = async (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.userId;

  try {
    // Перевірити чи користувач капітан цієї команди
    const isCaptain = await pool.query(
      `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 AND is_captain = TRUE`,
      [teamId, userId]
    );
    if (!isCaptain.rows.length) {
      return res.status(403).json({ error: "Тільки капітан може видалити команду" });
    }

    // Видалити всіх учасників
    await pool.query(`DELETE FROM team_members WHERE team_id = $1`, [teamId]);
    // Видалити команду
    await pool.query(`DELETE FROM teams WHERE id = $1`, [teamId]);
    res.json({ message: "Команду видалено" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Помилка сервера" });
  }
};
