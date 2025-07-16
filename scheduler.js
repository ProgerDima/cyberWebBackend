const cron = require('node-cron');
const { autoCleanupExpiredTournaments } = require('./controllers/cleanupController');

// Запускати кожну годину
cron.schedule('0 * * * *', async () => {
  console.log('🔄 Запуск автоочищення турнірів...');
  try {
    const deleted = await autoCleanupExpiredTournaments();
    if (deleted.length > 0) {
      console.log(`✅ Автоочищення завершено. Видалено ${deleted.length} турнірів.`);
    } else {
      console.log('✅ Автоочищення завершено. Турнірів для видалення не знайдено.');
    }
  } catch (error) {
    console.error('❌ Помилка автоочищення:', error);
  }
});

console.log('🕐 Scheduler ініціалізовано - автоочищення турнірів кожну годину');

module.exports = cron;
