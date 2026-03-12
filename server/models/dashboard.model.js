const db = require("../config/db");

const Dashboard = {
  async getStats() {
    const [[totalUsers]] = await db.execute(
      "SELECT COUNT(*) as count FROM users",
    );

    const [[totalTemplates]] = await db.execute(
      "SELECT COUNT(*) as count FROM certificate_templates",
    );

    const [[totalCertificates]] = await db.execute(
      "SELECT COUNT(*) as count FROM certificates",
    );

    const [[totalBatches]] = await db.execute(
      "SELECT COUNT(*) as count FROM upload_batches",
    );

    const [[batchStatus]] = await db.execute(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
         COALESCE(SUM(CASE WHEN status = 'generating' THEN 1 ELSE 0 END), 0) AS generating,
         COALESCE(SUM(CASE WHEN status = 'generated' THEN 1 ELSE 0 END), 0) AS generated,
         COALESCE(SUM(CASE WHEN status = 'partial_generated' THEN 1 ELSE 0 END), 0) AS partialGenerated,
         COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed
       FROM upload_batches`,
    );

    const [recentCertificates] = await db.execute(
      `SELECT id, certificate_no, student_name, school_name, created_at
       FROM certificates
       ORDER BY created_at DESC
       LIMIT 5`,
    );

    return {
      totalUsers: totalUsers.count,
      totalTemplates: totalTemplates.count,
      totalCertificates: totalCertificates.count,
      totalBatches: totalBatches.count,
      batchStatus,
      recentCertificates,
    };
  },
};

module.exports = Dashboard;
