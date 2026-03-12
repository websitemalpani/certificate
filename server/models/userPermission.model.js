const db = require("../config/db");
const { normalizePermissionList } = require("../utils/permissions");

const UserPermission = {
  async getByUserId(userId) {
    const [rows] = await db.execute(
      "SELECT permission FROM user_permissions WHERE user_id = ? ORDER BY permission ASC",
      [userId],
    );
    return rows.map((row) => row.permission);
  },

  async replaceForUser(userId, permissions = []) {
    const normalizedPermissions = normalizePermissionList(permissions);
    await db.execute("DELETE FROM user_permissions WHERE user_id = ?", [userId]);

    if (!normalizedPermissions.length) return;

    const values = normalizedPermissions.map((permission) => [userId, permission]);
    await db.query(
      "INSERT INTO user_permissions (user_id, permission) VALUES ?",
      [values],
    );
  },
};

module.exports = UserPermission;
