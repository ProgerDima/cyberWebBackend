const express = require("express");
const router = express.Router();
const teamController = require("../controllers/teamController");
const verifyToken = require("../middleware/authMiddleware");
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

// Інформація про команду
router.get("/:id", 
    verifyToken, 
    teamController.getTeamDetails
);

// Рейтинг команди
router.get("/:id/rating", 
    verifyToken, 
    teamController.getTeamRating
);

// Профіль команди
router.get("/:id/profile", 
    verifyToken, 
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