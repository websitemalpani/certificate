const Dashboard = require("../models/dashboard.model");

exports.getStats = async (req, res, next) => {
  try {
    const stats = await Dashboard.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};
