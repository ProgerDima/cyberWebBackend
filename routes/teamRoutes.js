const express = require("express");
const router = express.Router();
const teamController = require("../controllers/teamController");
const verifyToken = require("../middleware/authMiddleware");
const optionalAuth = require("../middleware/optionalAuth");
const isCaptain = require("../middleware/isCaptain");
const { check } = require('express-validator');

// Створення команди
router.post("/", 
    verifyToken,
    [
        check('name').isLength({ min: 3, max: 50 }).withMessage('Назва команди повинна містити від 3 до 50 символів'),
        check('discipline').isIn(['Футбол', 'Баскетбол', 'Волейбол', 'Кіберспорт']).withMessage('Невірна дисципліна')
    ],
    teamController.createTeam
);

// Додавання учасника (тільки для капітана)
router.post("/:teamId/members", 
    verifyToken, 
    isCaptain, 
    teamController.addMember
);

// Запрошення користувача до команди
router.post("/:teamId/invite", 
    verifyToken, 
    teamController.inviteUser
);

// Отримати всі запрошення користувача
router.get("/invites", 
    verifyToken, 
    teamController.getUserInvites
);

// Прийняти запрошення
router.post("/invites/:inviteId/accept", 
    verifyToken, 
    teamController.acceptInvite
);

// Відхилити запрошення
router.post("/invites/:inviteId/decline", 
    verifyToken, 
    teamController.declineInvite
);

// Приєднання до команди
router.post("/:teamId/join", 
    verifyToken, 
    teamController.joinTeam
);

// Вихід з команди
router.post('/:teamId/leave', verifyToken, teamController.leaveTeam);

// Список команд користувача
router.get("/my", 
    verifyToken, 
    teamController.getUserTeams
);
// Список команд, де користувач є капітаном
router.get("/captain", verifyToken, teamController.getCaptainTeams);

// Debug endpoint для перевірки команд капітана
router.get("/captain/debug/:tournamentId", verifyToken, async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user.userId;
  
  try {
    const pool = require("../config/db");
    
    // Отримуємо всі команди капітана
    const allTeams = await pool.query(`
      SELECT t.id, t.name, COUNT(tm2.user_id) AS members_count
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      LEFT JOIN team_members tm2 ON tm2.team_id = t.id
      WHERE tm.user_id = $1 AND tm.is_captain = TRUE
      GROUP BY t.id, t.name
    `, [userId]);
    
    // Отримуємо параметри турніру
    const tournament = await pool.query(`
      SELECT players_per_team FROM tournaments WHERE id = $1
    `, [tournamentId]);
    
    // Отримуємо команди, які вже зареєстровані на турнір
    const registeredTeams = await pool.query(`
      SELECT team_id FROM tournament_teams WHERE tournament_id = $1
    `, [tournamentId]);
    
    res.json({
      userId,
      tournamentId,
      tournament: tournament.rows[0],
      allTeams: allTeams.rows,
      registeredTeams: registeredTeams.rows,
      availableTeams: allTeams.rows.filter(team => 
        !registeredTeams.rows.some(rt => rt.team_id === team.id) &&
        parseInt(team.members_count) <= tournament.rows[0]?.players_per_team
      )
    });
  } catch (err) {
    console.error('Debug error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Інформація про команду (з опціональною авторизацією)
router.get("/:id", 
    optionalAuth,
    teamController.getTeamDetails
);

// Рейтинг команди (з опціональною авторизацією)
router.get("/:id/rating", 
    optionalAuth,
    teamController.getTeamRating
);

// Профіль команди (з опціональною авторизацією)
router.get("/:id/profile", 
    optionalAuth,
    teamController.getTeamProfile
);

// Список всіх команд
router.get("/", 
    teamController.getAllTeams
);



// Видалити команду (тільки для капітана)
router.delete('/:teamId',
    verifyToken,
    isCaptain,
    teamController.deleteTeam
);

module.exports = router;