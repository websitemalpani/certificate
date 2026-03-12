const db = require("../config/db");

const Template = {
  async create(data) {
    const {
      title,
      image_path,
      signature_path,
      qr_x,
      qr_y,
      qr_size,
      signature_x,
      signature_y,
      watermark_enabled,
      watermark_text,
      created_by,
    } = data;

    const [result] = await db.execute(
      `INSERT INTO certificate_templates
      (title, image_path, signature_path,
       qr_x, qr_y, qr_size,
       signature_x, signature_y,
       watermark_enabled, watermark_text,
       created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        image_path,
        signature_path,
        qr_x,
        qr_y,
        qr_size,
        signature_x,
        signature_y,
        watermark_enabled,
        watermark_text,
        created_by,
      ],
    );

    return result.insertId;
  },

  async getAll() {
    const [rows] = await db.execute(
      "SELECT * FROM certificate_templates ORDER BY created_at DESC",
    );
    return rows;
  },

  async getById(id) {
    const [rows] = await db.execute(
      "SELECT * FROM certificate_templates WHERE id = ?",
      [id],
    );
    return rows[0];
  },

  async delete(id) {
    await db.execute("DELETE FROM certificate_templates WHERE id = ?", [id]);
  },

  async addField(data) {
    const {
      template_id,
      field_name,
      x_position,
      y_position,
      font_size,
      font_family,
      font_color,
    } = data;

    const [result] = await db.execute(
      `INSERT INTO template_fields
       (template_id, field_name, x_position, y_position, font_size, font_family, font_color)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        template_id,
        field_name,
        x_position,
        y_position,
        font_size,
        font_family,
        font_color,
      ],
    );

    return result.insertId;
  },

  async getFields(templateId) {
    const [rows] = await db.execute(
      "SELECT * FROM template_fields WHERE template_id = ?",
      [templateId],
    );
    return rows;
  },

  async updateField(fieldId, data) {
    const {
      field_name,
      x_position,
      y_position,
      font_size,
      font_family,
      font_color,
    } = data;

    await db.execute(
      `UPDATE template_fields
       SET field_name=?, x_position=?, y_position=?, font_size=?, font_family=?, font_color=?
       WHERE id=?`,
      [
        field_name,
        x_position,
        y_position,
        font_size,
        font_family,
        font_color,
        fieldId,
      ],
    );
  },

  async deleteField(fieldId) {
    await db.execute("DELETE FROM template_fields WHERE id = ?", [fieldId]);
  },

  async updateSignaturePosition(id, data) {
    await db.execute(
      "UPDATE certificate_templates SET signature_x=?, signature_y=? WHERE id=?",
      [data.signature_x, data.signature_y, id],
    );
  },

  async updateQrPosition(id, data) {
    await db.execute(
      "UPDATE certificate_templates SET qr_x=?, qr_y=?, qr_size=? WHERE id=?",
      [data.qr_x, data.qr_y, data.qr_size, id],
    );
  },
};

module.exports = Template;
