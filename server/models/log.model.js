const db = require("../config/db");

const Log = {
  async create(data) {
    const { user_id, action, ip_address } = data;

    await db.execute(
      "INSERT INTO activity_logs (user_id, action, ip_address) VALUES (?, ?, ?)",
      [user_id, action, ip_address],
    );
  },

  async getAll() {
    const [rows] = await db.execute(
      "SELECT * FROM activity_logs ORDER BY created_at DESC",
    );
    return rows;
  },
};

module.exports = Log;
