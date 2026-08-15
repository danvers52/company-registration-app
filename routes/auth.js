const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');
const {
  isValidEmail,
  isValidPassword,
  isValidRole,
  isNonEmptyString,
  sendError,
} = require('../utils/validators');
const { jwtSecret, jwtExpiresIn } = require('../utils/config');
const {
  getEmailDomain,
  resolveCompanyByEmail,
  ensureCompanyByEmail,
  requireCompanyForRequest,
} = require('../utils/tenant');

const router = express.Router();

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const verifyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Register (Admin only)
router.post('/register', verifyToken, requireCompanyForRequest, verifyAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!isNonEmptyString(name)) {
      return sendError(res, 400, 'Name is required');
    }

    if (!isValidEmail(email)) {
      return sendError(res, 400, 'A valid email is required');
    }

    if (!isValidPassword(password)) {
      return sendError(res, 400, 'Password must be at least 8 characters long');
    }

    if (!isValidRole(role || 'employee')) {
      return sendError(res, 400, 'Role must be either employee or admin');
    }

    const adminCompany = req.company;
    if (!adminCompany) {
      return sendError(res, 400, 'Admin company not found');
    }

    const employeeCompany = await ensureCompanyByEmail(email);
    if (!employeeCompany) {
      return sendError(res, 400, 'Company for employee email not found');
    }

    if (employeeCompany._id.toString() !== adminCompany._id.toString()) {
      return sendError(res, 403, 'Admins can only create employees for their own company');
    }

    // Check if user already exists
    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      return sendError(res, 400, 'Email already in use');
    }

    const employee = new Employee({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: role || 'employee',
      company: adminCompany._id,
    });

    await employee.save();

    // Log action
    new AuditLog({
      employeeId: req.user.id,
      action: 'add-employee',
      details: `Added employee: ${name} (${email})`,
    }).save();

    res.status(201).json({ message: 'Employee registered successfully', employee });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function hasAdminForCompany(companyId) {
  return await Employee.exists({ role: 'admin', company: companyId });
}

// Signup for first admin per company domain only
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!isNonEmptyString(name)) {
      return sendError(res, 400, 'Name is required');
    }
    if (!isValidEmail(email)) {
      return sendError(res, 400, 'A valid email is required');
    }
    if (!isValidPassword(password)) {
      return sendError(res, 400, 'Password must be at least 8 characters long');
    }

    const employeeCompany = await ensureCompanyByEmail(email);
    if (!employeeCompany) {
      return sendError(res, 400, 'Unable to resolve company for email domain');
    }

    if (await hasAdminForCompany(employeeCompany._id)) {
      return sendError(res, 403, 'An admin for this email domain already exists');
    }

    const existingEmployee = await Employee.findOne({ email: email.trim().toLowerCase() });
    if (existingEmployee) {
      return sendError(res, 400, 'Email already in use');
    }

    const employee = new Employee({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: 'admin',
      company: employeeCompany._id,
      isActive: true,
    });

    await employee.save();

    const token = jwt.sign(
      { id: employee._id, email: employee.email, role: employee.role, companyId: employee.company },
      jwtSecret,
      { expiresIn: jwtExpiresIn }
    );

    res.status(201).json({
      token,
      user: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        companyId: employee.company,
        companyName: employeeCompany.name,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isValidEmail(email) || !isNonEmptyString(password)) {
      return sendError(res, 400, 'Email and password are required');
    }

    const employee = await Employee.findOne({ email: email.trim().toLowerCase() }).populate('company', 'name');
    if (!employee || !(await employee.comparePassword(password))) {
      return sendError(res, 401, 'Invalid credentials');
    }

    if (!employee.isActive) {
      return sendError(res, 403, 'Account is inactive');
    }

    const token = jwt.sign(
      { id: employee._id, email: employee.email, role: employee.role, companyId: employee.company?._id || employee.company },
      jwtSecret,
      { expiresIn: jwtExpiresIn }
    );

    const companyName = employee.company?.name || 'Unknown';

    // Log action
    new AuditLog({
      employeeId: employee._id,
      action: 'login',
      details: `${employee.role === 'admin' ? 'Admin' : 'Employee'} logged in`,
    }).save();

    res.json({
      token,
      user: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        companyId: employee.company,
        companyName,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!isValidEmail(email)) {
      return sendError(res, 400, 'A valid email is required');
    }

    const employee = await Employee.findOne({ email: email.trim().toLowerCase() });
    if (!employee) {
      return sendError(res, 404, 'No account found with that email');
    }

    const token = crypto.randomBytes(24).toString('hex');
    employee.resetPasswordToken = token;
    employee.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await employee.save();

    new AuditLog({
      employeeId: employee._id,
      action: 'password-reset-request',
      details: 'Password reset requested',
    }).save();

    res.json({
      message: 'Password reset token generated. Use the token to reset your password.',
      resetToken: token,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!isNonEmptyString(token) || !isValidPassword(password)) {
      return sendError(res, 400, 'Valid token and a new password of at least 8 characters are required');
    }

    const employee = await Employee.findOne({
      resetPasswordToken: token.trim(),
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!employee) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    employee.password = password;
    employee.resetPasswordToken = undefined;
    employee.resetPasswordExpires = undefined;
    await employee.save();

    new AuditLog({
      employeeId: employee._id,
      action: 'password-reset',
      details: 'Password reset completed',
    }).save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current authenticated user
router.get('/me', verifyToken, async (req, res) => {
  try {
    const employee = await Employee.findById(req.user.id).populate('company', 'name');
    if (!employee) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: employee._id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      companyId: employee.company,
      companyName: employee.company?.name || 'Unknown',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // Get user role for audit log
    const employee = await Employee.findById(req.user.id);
    const userRole = employee?.role === 'admin' ? 'Admin' : 'Employee';
    
    new AuditLog({
      employeeId: req.user.id,
      action: 'logout',
      details: `${userRole} logged out`,
    }).save();

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
