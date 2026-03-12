const db = require("../config/db");
const UserPermission = require("./userPermission.model");
const { normalizeRole } = require("../utils/permissions");

const User = {
  async create(data) {
    const { name, email, mobile, password, role, status = "a", facility_id = null } = data;

    const [result] = await db.execute(
      "INSERT INTO users (name, email, mobile, password, role, status, facility_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [name, email, mobile, password, normalizeRole(role), status, facility_id],
    );

    return result.insertId;
  },

  async findByEmail(email) {
    const [rows] = await db.execute(
      `SELECT u.*, f.name AS facility_name, f.code AS facility_code
       FROM users u
       LEFT JOIN facilities f ON f.id = u.facility_id
       WHERE u.email = ?`,
      [email],
    );
    return rows[0];
  },

  async getAll() {
    const [rows] = await db.execute(
      `SELECT u.id, u.name, u.email, u.mobile, u.role, u.status, u.facility_id, u.created_at,
              f.name AS facility_name, f.code AS facility_code
       FROM users u
       LEFT JOIN facilities f ON f.id = u.facility_id
       ORDER BY u.created_at DESC`,
    );

    const withPermissions = await Promise.all(
      rows.map(async (row) => {
        const permissions = await UserPermission.getByUserId(row.id);
        return { ...row, permissions };
      }),
    );

    return withPermissions;
  },

  async getAuthProfileByEmail(email) {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const permissions = await UserPermission.getByUserId(user.id);
    return {
      ...user,
      permissions,
    };
  },

  async getAuthProfileById(id) {
    const [rows] = await db.execute(
      `SELECT u.*, f.name AS facility_name, f.code AS facility_code
       FROM users u
       LEFT JOIN facilities f ON f.id = u.facility_id
       WHERE u.id = ?`,
      [id],
    );

    const user = rows[0];
    if (!user) return null;

    const permissions = await UserPermission.getByUserId(user.id);
    return { ...user, permissions };
  },

  async getById(id) {
    const [rows] = await db.execute(
      `SELECT u.id, u.name, u.email, u.mobile, u.role, u.status, u.facility_id, u.created_at,
              f.name AS facility_name, f.code AS facility_code
       FROM users u
       LEFT JOIN facilities f ON f.id = u.facility_id
       WHERE u.id = ?`,
      [id],
    );

    const user = rows[0];
    if (!user) return null;

    const permissions = await UserPermission.getByUserId(user.id);
    return { ...user, permissions };
  },

  async update(id, data) {
    const { name, email, mobile, role, status, facility_id } = data;

    await db.execute(
      "UPDATE users SET name = ?, email = ?, mobile = ?, role = ?, status = ?, facility_id = ? WHERE id = ?",
      [name, email, mobile, normalizeRole(role), status, facility_id, id],
    );
  },

  async updatePassword(id, password) {
    await db.execute("UPDATE users SET password = ? WHERE id = ?", [password, id]);
  },

  async upsertPermissions(id, permissions = []) {
    await UserPermission.replaceForUser(id, permissions);
  },

  async delete(id) {
    await db.execute("DELETE FROM users WHERE id = ?", [id]);
  },

  async emailExists(email, exceptId = null) {
    const [rows] = exceptId
      ? await db.execute("SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1", [email, exceptId])
      : await db.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    return rows.length > 0;
  },

  async mobileExists(mobile, exceptId = null) {
    const [rows] = exceptId
      ? await db.execute("SELECT id FROM users WHERE mobile = ? AND id != ? LIMIT 1", [mobile, exceptId])
      : await db.execute("SELECT id FROM users WHERE mobile = ? LIMIT 1", [mobile]);
    return rows.length > 0;
  },

  async getAllFacilities() {
    const [rows] = await db.execute(
      "SELECT id, name, code, status, created_at FROM facilities ORDER BY name ASC",
    );
    return rows;
  },
};

module.exports = User;
