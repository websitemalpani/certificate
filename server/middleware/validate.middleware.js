exports.validateRegister = (req, res, next) => {
  const { name, email, mobile, password } = req.body;

  if (!name || !email || !mobile || !password) {
    return res.status(400).json({
      success: false,
      message: "Name, email, mobile and password are required",
    });
  }

  next();
};

exports.validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required",
    });
  }

  next();
};
