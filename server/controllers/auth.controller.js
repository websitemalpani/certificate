const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const env = require("../config/env");
const { resolvePermissions, normalizeRole } = require("../utils/permissions");

const buildAuthResponse = (user) => {
  const resolvedPermissions = resolvePermissions(user.role, user.permissions);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: normalizeRole(user.role),
    status: user.status,
    permissions: resolvedPermissions,
    facility: user.facility_id
      ? {
          id: user.facility_id,
          name: user.facility_name || "",
          code: user.facility_code || "",
        }
      : null,
  };
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, mobile, password, role } = req.body;

    const existingUser = await User.emailExists(email);
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    if (!mobile) {
      return res.status(400).json({ message: "Mobile is required" });
    }

    const existingMobile = await User.mobileExists(mobile);
    if (existingMobile) {
      return res.status(400).json({ message: "Mobile already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userId = await User.create({
      name,
      email,
      mobile,
      password: hashedPassword,
      role: normalizeRole(role || "user"),
      status: "a",
    });

    res.status(201).json({ message: "User registered", userId });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.getAuthProfileByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (String(user.status || "").toLowerCase() !== "a") {
      return res.status(403).json({ message: "User account is inactive" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const authUser = buildAuthResponse(user);
    const token = jwt.sign(
      {
        id: authUser.id,
        role: authUser.role,
        permissions: authUser.permissions,
        facilityId: authUser.facility?.id || null,
      },
      env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({ ...authUser, token });
  } catch (error) {
    next(error);
  }
};
