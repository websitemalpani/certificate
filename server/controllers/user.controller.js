const User = require("../models/user.model");
const Facility = require("../models/facility.model");
const bcrypt = require("bcryptjs");
const { normalizeRole, normalizePermissionList } = require("../utils/permissions");

const normalizeStatus = (status) => {
  const value = String(status || "a").trim().toLowerCase();
  if (value === "active") return "a";
  if (value === "inactive") return "i";
  return value === "i" ? "i" : "a";
};

exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.getAll();
    res.json(users);
  } catch (error) {
    next(error);
  }
};

exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.getById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, mobile, password, role, status, facility_id, permissions } = req.body;

    if (!name || !email || !mobile || !password) {
      return res.status(400).json({ message: "Name, email, mobile and password are required" });
    }

    const emailExists = await User.emailExists(email);
    if (emailExists) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const mobileExists = await User.mobileExists(mobile);
    if (mobileExists) {
      return res.status(409).json({ message: "Mobile already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await User.create({
      name,
      email,
      mobile,
      password: hashedPassword,
      role: normalizeRole(role || "user"),
      status: normalizeStatus(status),
      facility_id: facility_id || null,
    });

    await User.upsertPermissions(userId, normalizePermissionList(permissions));
    const createdUser = await User.getById(userId);

    res.status(201).json({
      message: "User created",
      user: createdUser,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const { name, email, mobile, role, status, facility_id, password, permissions } = req.body;

    const existingUser = await User.getById(userId);
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!name || !email || !mobile) {
      return res.status(400).json({ message: "Name, email and mobile are required" });
    }

    const emailExists = await User.emailExists(email, userId);
    if (emailExists) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const mobileExists = await User.mobileExists(mobile, userId);
    if (mobileExists) {
      return res.status(409).json({ message: "Mobile already exists" });
    }

    await User.update(userId, {
      name,
      email,
      mobile,
      role: normalizeRole(role || existingUser.role),
      status: normalizeStatus(status || existingUser.status),
      facility_id: facility_id || null,
    });

    if (password && String(password).trim()) {
      const hashedPassword = await bcrypt.hash(String(password), 10);
      await User.updatePassword(userId, hashedPassword);
    }

    if (Array.isArray(permissions)) {
      await User.upsertPermissions(userId, normalizePermissionList(permissions));
    }

    const updatedUser = await User.getById(userId);
    res.json({ message: "User updated", user: updatedUser });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    if (userId === req.user.id) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    await User.delete(userId);
    res.json({ message: "User deleted" });
  } catch (error) {
    next(error);
  }
};

exports.getAllFacilities = async (req, res, next) => {
  try {
    const facilities = await Facility.getAll();
    res.json(facilities);
  } catch (error) {
    next(error);
  }
};

exports.createFacility = async (req, res, next) => {
  try {
    const { name, code, status } = req.body;
    if (!name || !code) {
      return res.status(400).json({ message: "Facility name and code are required" });
    }

    const facilityId = await Facility.create({
      name: String(name).trim(),
      code: String(code).trim().toUpperCase(),
      status: normalizeStatus(status),
    });

    res.status(201).json({ message: "Facility created", facilityId });
  } catch (error) {
    next(error);
  }
};

exports.getCurrentUserProfile = async (req, res, next) => {
  try {
    const user = await User.getById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};
