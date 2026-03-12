const db = require("../config/db");

const Facility = {
  async getAll() {
    const [rows] = await db.execute(
      "SELECT id, name, code, status, created_at FROM facilities ORDER BY name ASC",
    );
    return rows;
  },

  async create({ name, code, status = "a" }) {
    const [result] = await db.execute(
      "INSERT INTO facilities (name, code, status) VALUES (?, ?, ?)",
      [name, code, status],
    );
    return result.insertId;
  },
};

module.exports = Facility;
