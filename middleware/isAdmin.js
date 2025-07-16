module.exports = (req, res, next) => {
  // Перевірка наявності req.user
  if (!req.user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  // Перевірка ролі на адміна (2 - якщо це твій код для admin)
  if (req.user.role !== 2 && req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
};
