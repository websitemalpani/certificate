const bcrypt = require("bcryptjs");
const db = require("../config/db");

const readArg = (key) => {
  const npmConfigValue = process.env[`npm_config_${key}`];
  if (npmConfigValue) return npmConfigValue;

  const prefix = `--${key}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : "";
};

const name = readArg("name") || process.env.ADMIN_NAME || "Admin";
const email = readArg("email") || process.env.ADMIN_EMAIL || "";
const password = readArg("password") || process.env.ADMIN_PASSWORD || "";
const mobile = readArg("mobile") || process.env.ADMIN_MOBILE || "9999999999";

if (!email || !password) {
  // eslint-disable-next-line no-console
  console.error(
    "Missing admin credentials. Use --email=... --password=... [--name=...] or set ADMIN_EMAIL/ADMIN_PASSWORD.",
  );
  process.exit(1);
}

const run = async () => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const [columns] = await db.execute("SHOW COLUMNS FROM users");
  const hasMobileColumn = columns.some((column) => column.Field === "mobile");

  const existingQuery = hasMobileColumn
    ? "SELECT id FROM users WHERE email = ? OR mobile = ? LIMIT 1"
    : "SELECT id FROM users WHERE email = ? LIMIT 1";
  const existingParams = hasMobileColumn ? [email, mobile] : [email];
  const [existing] = await db.execute(existingQuery, existingParams);

  if (existing.length > 0) {
    const updateQuery = hasMobileColumn
      ? "UPDATE users SET name = ?, password = ?, mobile = ?, role = 'admin', status = 'a' WHERE id = ?"
      : "UPDATE users SET name = ?, password = ?, role = 'admin', status = 'a' WHERE id = ?";
    const updateParams = hasMobileColumn
      ? [name, hashedPassword, mobile, existing[0].id]
      : [name, hashedPassword, existing[0].id];
    await db.execute(updateQuery, updateParams);
    // eslint-disable-next-line no-console
    console.log(`Admin updated: ${email}`);
  } else {
    const insertQuery = hasMobileColumn
      ? "INSERT INTO users (name, email, password, mobile, role, status) VALUES (?, ?, ?, ?, 'admin', 'a')"
      : "INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, 'admin', 'a')";
    const insertParams = hasMobileColumn
      ? [name, email, hashedPassword, mobile]
      : [name, email, hashedPassword];
    await db.execute(insertQuery, insertParams);
    // eslint-disable-next-line no-console
    console.log(`Admin created: ${email}`);
  }
};

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.end();
    } catch (_) {}
  });
