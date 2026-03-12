const db = require("../config/db");

const Batch = {
  async create(data) {
    const { template_id, uploaded_by, total_records, csv_file_path } = data;

    const [result] = await db.execute(
      `INSERT INTO upload_batches 
       (template_id, uploaded_by, total_records, csv_file_path) 
       VALUES (?, ?, ?, ?)`,
      [template_id, uploaded_by, total_records, csv_file_path],
    );

    return result.insertId;
  },

  async getAll() {
    const [rows] = await db.execute(
      "SELECT * FROM upload_batches ORDER BY created_at DESC",
    );
    return rows;
  },

  async getById(id) {
    const [rows] = await db.execute(
      "SELECT * FROM upload_batches WHERE id = ?",
      [id],
    );
    return rows[0];
  },

  async updateStatus(id, status) {
    await db.execute("UPDATE upload_batches SET status = ? WHERE id = ?", [
      status,
      id,
    ]);
  },

  async getProgress(id) {
    const [rows] = await db.execute(
      `SELECT
         b.id,
         b.status,
         b.total_records,
         COALESCE(c.generated_count, 0) AS generated_count
       FROM upload_batches b
       LEFT JOIN (
         SELECT batch_id, COUNT(*) AS generated_count
         FROM certificates
         GROUP BY batch_id
       ) c ON c.batch_id = b.id
       WHERE b.id = ?`,
      [id],
    );

    return rows[0];
  },

  async delete(id) {
    await db.execute("DELETE FROM upload_batches WHERE id = ?", [id]);
  },
};

module.exports = Batch;
