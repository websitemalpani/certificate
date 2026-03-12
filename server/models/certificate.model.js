const db = require("../config/db");

const toPositiveIntOrNull = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const Certificate = {
  async create(data) {
    const {
      batch_id,
      template_id,
      certificate_no,
      student_name,
      school_name,
      mobile,
      email,
      data_json,
      file_path,
    } = data;

    const [result] = await db.execute(
      `INSERT INTO certificates 
     (batch_id, template_id, certificate_no, student_name, school_name, mobile, email, data_json, file_path) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batch_id,
        template_id,
        certificate_no,
        student_name,
        school_name,
        mobile || null,
        email || null,
        JSON.stringify(data_json),
        file_path,
      ],
    );

    // 🔥 Return auto-generated serial (id)
    return result.insertId;
  },

  async getAll({ templateId, batchId } = {}) {
    const conditions = [];
    const params = [];
    const normalizedTemplateId = toPositiveIntOrNull(templateId);
    const normalizedBatchId = toPositiveIntOrNull(batchId);

    if (normalizedTemplateId !== null) {
      conditions.push("template_id = ?");
      params.push(normalizedTemplateId);
    }

    if (normalizedBatchId !== null) {
      conditions.push("batch_id = ?");
      params.push(normalizedBatchId);
    }

    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await db.execute(
      `SELECT * FROM certificates${where} ORDER BY created_at DESC`,
      params,
    );
    return rows;
  },

  async getPaginated({ page, limit, templateId, batchId }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    const normalizedTemplateId = toPositiveIntOrNull(templateId);
    const normalizedBatchId = toPositiveIntOrNull(batchId);

    if (normalizedTemplateId !== null) {
      conditions.push("template_id = ?");
      params.push(normalizedTemplateId);
    }

    if (normalizedBatchId !== null) {
      conditions.push("batch_id = ?");
      params.push(normalizedBatchId);
    }

    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await db.execute(
      `SELECT * FROM certificates${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows;
  },

  async countAll({ templateId, batchId } = {}) {
    const conditions = [];
    const params = [];
    const normalizedTemplateId = toPositiveIntOrNull(templateId);
    const normalizedBatchId = toPositiveIntOrNull(batchId);

    if (normalizedTemplateId !== null) {
      conditions.push("template_id = ?");
      params.push(normalizedTemplateId);
    }

    if (normalizedBatchId !== null) {
      conditions.push("batch_id = ?");
      params.push(normalizedBatchId);
    }

    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    const [[row]] = await db.execute(
      `SELECT COUNT(*) AS count FROM certificates${where}`,
      params,
    );
    return Number(row.count || 0);
  },

  async getByTemplateId(templateId) {
    const [rows] = await db.execute(
      "SELECT * FROM certificates WHERE template_id = ? ORDER BY created_at DESC",
      [templateId],
    );
    return rows;
  },

  async getById(id) {
    const [rows] = await db.execute("SELECT * FROM certificates WHERE id = ?", [
      id,
    ]);
    return rows[0];
  },

  async getByCertificateNo(certificateNo) {
    const [rows] = await db.execute(
      "SELECT * FROM certificates WHERE certificate_no = ?",
      [certificateNo],
    );
    return rows[0];
  },

  async searchByTerm(term, limit = 25) {
    const text = `%${String(term || "").trim()}%`;
    const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
    const [rows] = await db.execute(
      `SELECT *
       FROM certificates
       WHERE certificate_no LIKE ?
          OR student_name LIKE ?
          OR school_name LIKE ?
          OR data_json LIKE ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [text, text, text, text, safeLimit],
    );
    return rows;
  },

  async countByBatchId(batchId) {
    const [[row]] = await db.execute(
      "SELECT COUNT(*) as count FROM certificates WHERE batch_id = ?",
      [batchId],
    );
    return row.count;
  },

  async getByBatchId(batchId) {
    const [rows] = await db.execute(
      "SELECT * FROM certificates WHERE batch_id = ? ORDER BY created_at DESC",
      [batchId],
    );
    return rows;
  },

  async update(id, data) {
    const { student_name, school_name, mobile, email, data_json, file_path } = data;
    await db.execute(
      `UPDATE certificates
       SET student_name = ?, school_name = ?, mobile = ?, email = ?, data_json = ?, file_path = ?
       WHERE id = ?`,
      [student_name, school_name, mobile || null, email || null, JSON.stringify(data_json || {}), file_path, id],
    );
  },

  async getByContact(mobile, email) {
    const [rows] = await db.execute(
      `SELECT * FROM certificates
       WHERE mobile = ? AND LOWER(email) = LOWER(?)
       ORDER BY created_at DESC`,
      [mobile, email],
    );
    return rows;
  },

  async getByIdAndContact(id, mobile, email) {
    const [rows] = await db.execute(
      `SELECT * FROM certificates
       WHERE id = ? AND mobile = ? AND LOWER(email) = LOWER(?)
       LIMIT 1`,
      [id, mobile, email],
    );
    return rows[0];
  },

  async getByPublicContact({ mobile, email }) {
    let query = "SELECT * FROM certificates WHERE 1=1";
    const params = [];

    if (mobile) {
      query += " AND mobile = ?";
      params.push(mobile);
    }

    if (email) {
      query += " AND LOWER(email) = LOWER(?)";
      params.push(email);
    }

    query += " ORDER BY created_at DESC";
    const [rows] = await db.execute(query, params);
    return rows;
  },

  async delete(id) {
    await db.execute("DELETE FROM certificates WHERE id = ?", [id]);
  },
};

module.exports = Certificate;
