const pool = require('./config/db');

async function createAdmin() {
  try {
    // Перевіряємо, чи існує адмін
    const existing = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      ["admin"]
    );
    
    if (existing.rows.length > 0) {
      console.log('Адмін користувач вже існує');
      return;
    }
    
    // Створюємо адмін користувача
    const result = await pool.query(
      "INSERT INTO users (username, password, role_id) VALUES ($1, $2, $3) RETURNING id, username, role_id",
      ["admin", "admin123", 2] // role_id 2 = admin
    );
    
    console.log('Адмін користувач створений:', result.rows[0]);
    console.log('Логін: admin');
    console.log('Пароль: admin123');
    
  } catch (error) {
    console.error('Помилка створення адміна:', error);
  } finally {
    process.exit();
  }
}

createAdmin();
