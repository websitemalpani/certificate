const db = require("../config/db");
const logger = require("./logger");

const ensureFacilitiesTable = async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS facilities (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(100) NOT NULL,
      status CHAR(1) NOT NULL DEFAULT 'a',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_facility_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
};

const ensureUsersFacilityColumn = async () => {
  const [existing] = await db.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'facility_id'
    LIMIT 1
  `);

  if (existing.length === 0) {
    await db.execute("ALTER TABLE users ADD COLUMN facility_id INT NULL AFTER status");
  }

  const [fkRows] = await db.execute(`
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'facility_id'
      AND REFERENCED_TABLE_NAME = 'facilities'
    LIMIT 1
  `);

  if (fkRows.length === 0) {
    await db.execute(`
      ALTER TABLE users
      ADD CONSTRAINT fk_users_facility
      FOREIGN KEY (facility_id) REFERENCES facilities(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE
    `);
  }
};

const ensureUserPermissionsTable = async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      permission VARCHAR(100) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_permission (user_id, permission),
      CONSTRAINT fk_user_permissions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
};

const ensureCertificatesContactColumns = async () => {
  const [mobileCol] = await db.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'certificates'
      AND COLUMN_NAME = 'mobile'
    LIMIT 1
  `);

  if (mobileCol.length === 0) {
    await db.execute("ALTER TABLE certificates ADD COLUMN mobile VARCHAR(20) NULL AFTER school_name");
  }

  const [emailCol] = await db.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'certificates'
      AND COLUMN_NAME = 'email'
    LIMIT 1
  `);

  if (emailCol.length === 0) {
    await db.execute("ALTER TABLE certificates ADD COLUMN email VARCHAR(255) NULL AFTER mobile");
  }
};

const ensureTemplateQrSizeColumn = async () => {
  const [qrSizeCol] = await db.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'certificate_templates'
      AND COLUMN_NAME = 'qr_size'
    LIMIT 1
  `);

  if (qrSizeCol.length === 0) {
    await db.execute(
      "ALTER TABLE certificate_templates ADD COLUMN qr_size INT NOT NULL DEFAULT 120 AFTER qr_y",
    );
  }
};

const ensureUploadBatchStatusColumn = async () => {
  const [statusCol] = await db.execute(`
    SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'upload_batches'
      AND COLUMN_NAME = 'status'
    LIMIT 1
  `);

  if (!statusCol.length) return;

  const col = statusCol[0];
  const isShortText =
    String(col.DATA_TYPE || "").toLowerCase() === "char" ||
    Number(col.CHARACTER_MAXIMUM_LENGTH || 0) < 16;

  if (isShortText) {
    await db.execute(`
      ALTER TABLE upload_batches
      MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pending'
    `);
  }

  await db.execute(`
    UPDATE upload_batches b
    LEFT JOIN (
      SELECT batch_id, COUNT(*) AS generated_count
      FROM certificates
      GROUP BY batch_id
    ) c ON c.batch_id = b.id
    SET b.status = CASE
      WHEN b.status = 'p' AND COALESCE(c.generated_count, 0) = 0 THEN 'pending'
      WHEN b.status = 'p'
        AND COALESCE(c.generated_count, 0) > 0
        AND COALESCE(c.generated_count, 0) < COALESCE(b.total_records, 0) THEN 'partial_generated'
      WHEN b.status = 'p'
        AND COALESCE(c.generated_count, 0) >= COALESCE(b.total_records, 0)
        AND COALESCE(b.total_records, 0) > 0 THEN 'generated'
      WHEN b.status = 'g'
        AND COALESCE(c.generated_count, 0) >= COALESCE(b.total_records, 0) THEN 'generated'
      WHEN b.status = 'g' THEN 'generating'
      WHEN b.status = 'f' THEN 'failed'
      WHEN b.status IN ('pending', 'generating', 'generated', 'partial_generated', 'failed') THEN b.status
      ELSE 'pending'
    END
  `);
};

const initAuthSchema = async () => {
  try {
    await ensureFacilitiesTable();
    await ensureUsersFacilityColumn();
    await ensureUserPermissionsTable();
    await ensureCertificatesContactColumns();
    await ensureTemplateQrSizeColumn();
    await ensureUploadBatchStatusColumn();
  } catch (error) {
    logger.error("Auth schema init failed", { message: error.message });
    throw error;
  }
};

module.exports = initAuthSchema;
