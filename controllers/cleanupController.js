// controllers/cleanupController.js
const pool = require("../config/db");

// Видалити турніри з завершеною реєстрацією
exports.cleanupExpiredTournaments = async (req, res) => {
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Спочатку отримуємо турніри, які потрібно видалити
      const tournamentsToDelete = await client.query(
        `SELECT id, name, registration_end 
         FROM tournaments 
         WHERE (registration_end < NOW() OR registration_end IS NULL)
         AND status = 'запланований'`
      );
      
      if (tournamentsToDelete.rows.length > 0) {
        const tournamentIds = tournamentsToDelete.rows.map(t => t.id);
        
        // Спочатку отримуємо всі матчі турнірів
        const matchesRes = await client.query(
          `SELECT id FROM matches WHERE tournament_id = ANY($1)`,
          [tournamentIds]
        );
        const matchIds = matchesRes.rows.map(m => m.id);
        
        // Видаляємо пов'язані дані в правильному порядку
        if (matchIds.length > 0) {
          // 1. Спочатку видаляємо player_stats
          await client.query(
            `DELETE FROM player_stats WHERE match_id = ANY($1)`,
            [matchIds]
          );
        }
        
        // 2. Потім видаляємо matches
        await client.query(
          `DELETE FROM matches WHERE tournament_id = ANY($1)`,
          [tournamentIds]
        );
        
        // 3. Видаляємо tournament_teams
        await client.query(
          `DELETE FROM tournament_teams WHERE tournament_id = ANY($1)`,
          [tournamentIds]
        );
        
        // 4. Нарешті видаляємо самі турніри
        await client.query(
          `DELETE FROM tournaments WHERE id = ANY($1)`,
          [tournamentIds]
        );
      }
      
      await client.query('COMMIT');
      
      res.json({ 
        message: "Турніри з завершеною або відсутньою датою реєстрації видалені",
        deletedTournaments: tournamentsToDelete.rows 
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Помилка при видаленні турнірів:", err);
    res.status(500).json({ error: "Помилка сервера" });
  }
};

// Автоматичне очищення (для cron job)
exports.autoCleanupExpiredTournaments = async () => {
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Спочатку отримуємо турніри, які потрібно видалити
      const tournamentsToDelete = await client.query(
        `SELECT id, name, registration_end 
         FROM tournaments 
         WHERE (registration_end < NOW() OR registration_end IS NULL)
         AND status = 'запланований'`
      );
      
      if (tournamentsToDelete.rows.length > 0) {
        const tournamentIds = tournamentsToDelete.rows.map(t => t.id);
        
        // Спочатку отримуємо всі матчі турнірів
        const matchesRes = await client.query(
          `SELECT id FROM matches WHERE tournament_id = ANY($1)`,
          [tournamentIds]
        );
        const matchIds = matchesRes.rows.map(m => m.id);
        
        // Видаляємо пов'язані дані в правильному порядку
        if (matchIds.length > 0) {
          // 1. Спочатку видаляємо player_stats
          await client.query(
            `DELETE FROM player_stats WHERE match_id = ANY($1)`,
            [matchIds]
          );
        }
        
        // 2. Потім видаляємо matches
        await client.query(
          `DELETE FROM matches WHERE tournament_id = ANY($1)`,
          [tournamentIds]
        );
        
        // 3. Видаляємо tournament_teams
        await client.query(
          `DELETE FROM tournament_teams WHERE tournament_id = ANY($1)`,
          [tournamentIds]
        );
        
        // 4. Нарешті видаляємо самі турніри
        await client.query(
          `DELETE FROM tournaments WHERE id = ANY($1)`,
          [tournamentIds]
        );
        
        console.log(`Видалено ${tournamentsToDelete.rows.length} турнірів з завершеною реєстрацією:`, 
                    tournamentsToDelete.rows.map(t => `${t.name} (закінчення: ${t.registration_end || 'не встановлено'})`));
      } else {
        console.log('Немає турнірів для видалення');
      }
      
      await client.query('COMMIT');
      return tournamentsToDelete.rows;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Помилка автоочищення турнірів:", err);
    return [];
  }
};