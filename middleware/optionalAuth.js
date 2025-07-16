const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('../config/config');

// Middleware для опціональної авторизації - не блокує, якщо токену немає
module.exports = function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    req.user = null; // Користувач не авторизований
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    req.user = null; // Невірний формат токена
    return next();
  }

  const token = parts[1];
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      req.user = null; // Невірний або прострочений токен
    } else {
      req.user = decoded; // Користувач авторизований
    }
    next();
  });
};
