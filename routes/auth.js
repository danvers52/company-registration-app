import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Employee from '../models/Employee.js';
import AuditLog from '../models/AuditLog.js';
import config from '../utils/config.js';

const { jwtSecret, jwtExpiresIn } = config;

import {isValidEmail, isValidPassword, isValidRole, isNonEmptyString, sendError} from '../utils/validators.js';

import {getEmailDomain, resolveCompanyByEmail, ensureCompanyByEmail, requireCompanyForRequest} from '../utils/tenant.js';
const router = express.Router();

// Middleware to verify token
export const verifyToken = (req, res, next) => {
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

export const verifyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Register (Admin only)
router.post('/register', verifyToken, requireCompanyForRequest, verifyAdmin, async (req, res) => {
  const session = await Employee.startSession();
  session.startTransaction();

  try {
    const { name, email, password, role } = req.body;
    if (!isNonEmptyString(name)) {
      await session.abortTransaction();
      return sendError(res, 400, 'Name is required');
    }

    if (!isValidEmail(email)) {
      await session.abortTransaction();
      return sendError(res, 400, 'A valid email is required');
    }

    if (!isValidPassword(password)) {
      await session.abortTransaction();
      return sendError(res, 400, 'Password must be at least 8 characters long');
    }

    if (!isValidRole(role || 'employee')) {
      await session.abortTransaction();
      return sendError(res, 400, 'Role must be either employee or admin');
    }

    const adminCompany = req.company;
    if (!adminCompany) {
      await session.abortTransaction();
      return sendError(res, 400, 'Admin company not found');
    }

    const employeeCompany = await ensureCompanyByEmail(email);
    if (!employeeCompany) {
      await session.abortTransaction();
      return sendError(res, 400, 'Company for employee email not found');
    }

    if (employeeCompany._id.toString() !== adminCompany._id.toString()) {
      await session.abortTransaction();
      return sendError(res, 403, 'Admins can only create employees for their own company');
    }

    // Check if user already exists
    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      await session.abortTransaction();
      return sendError(res, 400, 'Email already in use');
    }

    const employee = new Employee({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: role || 'employee',
      company: adminCompany._id,
    });

    await employee.save({session});

    // Log action
    await AuditLog.create([{
      employeeId: req.user.id,
      action: 'add-employee',
      details: `Added employee: ${name} (${email})`,
    }], {session});

    await session.commitTransaction();
    res.status(201).json({ message: 'Employee registered successfully', employee });
  } catch (error) {

    await session.abortTransaction();
    res.status(500).json({ error: error.message });
  } finally {
    session.endSession();
  }
});

export async function hasAdminForCompany(companyId) {
  return await Employee.exists({ role: 'admin', company: companyId });
}

// Signup for first admin per company domain only
router.post('/signup', async (req, res) => {
  const session = await Employee.startSession();
  session.startTransaction();

  try {
    const { name, email, password, role } = req.body;
    if (!isNonEmptyString(name)) {
      await session.abortTransaction();
      return sendError(res, 400, 'Name is required');
    }
    if (!isValidEmail(email)) {
      await session.abortTransaction();
      return sendError(res, 400, 'A valid email is required');
    }
    if (!isValidPassword(password)) {
      await session.abortTransaction();
      return sendError(res, 400, 'Password must be at least 8 characters long');
    }
    if (role !== undefined && role !== 'admin') {
      await session.abortTransaction();
      return sendError(res, 400, 'Role is fixed to admin for company signup');
    }

    const employeeCompany = await ensureCompanyByEmail(email);
    if (!employeeCompany) {
      await session.abortTransaction();
      return sendError(res, 400, 'Unable to resolve company for email domain');
    }

    if (await hasAdminForCompany(employeeCompany._id)) {
      await session.abortTransaction();
      return sendError(res, 403, 'An admin for this email domain already exists');
    }

    //check if employee already exists
    const existingEmployee = await Employee.findOne({ email: email.trim().toLowerCase() });
    if (existingEmployee) {
      await session.abortTransaction();
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

    await employee.save({session});

    await AuditLog.create([{
      employeeId: employee._id,
      action: 'signup',
      details: `Admin signup for ${employee.email}`,
    }], {session});

    await session.commitTransaction();

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
    await session.abortTransaction();
    res.status(500).json({ error: error.message });
  } finally {
    session.endSession();
  }
});

// Login
router.post('/login', async (req, res) => {
  const session = await Employee.startSession();
  session.startTransaction();

  try {
    const { email, password } = req.body;

    if (!isValidEmail(email) || !isNonEmptyString(password)) {
      await session.abortTransaction();
      return sendError(res, 400, 'Email and password are required');
    }

	const employee = await Employee.findOne({email: email.trim().toLowerCase()}).populate('company', 'name');
	if(!employee) {
    await session.abortTransaction();
		return sendError(res, 404, 'User account does not exist');
	}
	
    const isPasswordValid = await employee.comparePassword(password);
    if (!isPasswordValid) {
      await session.abortTransaction();
      return sendError(res, 401, 'Invalid credentials');
    }

    if (!employee.isActive) {
      await session.abortTransaction();
      return sendError(res, 403, 'Account is inactive');
    }
	
    //generating token
    const token = jwt.sign(
      { id: employee._id, email: employee.email, role: employee.role, companyId: employee.company?._id || employee.company },
      jwtSecret,
      { expiresIn: jwtExpiresIn }
    );

    const companyName = employee.company?.name || 'Unknown';

    // Log action
    await AuditLog.create([{
      employeeId: employee._id,
      action: 'login',
      details: `${employee.role === 'admin' ? 'Admin' : 'Employee'} logged in`,
    }], {session});

    await session.commitTransaction();

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
    await session.abortTransaction();
    res.status(500).json({ error: error.message });
  } finally {
    session.endSession();
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  const session = await Employee.startSession();
  session.startTransaction();

  try {
    const { email } = req.body;
    if (!isValidEmail(email)) {
      await session.abortTransaction();
      return sendError(res, 400, 'A valid email is required');
    }

    //fetching employee needing reset
    const employee = await Employee.findOne({ email: email.trim().toLowerCase() });
    if (!employee) {
      await session.abortTransaction();
      return sendError(res, 404, 'No account found with that email');
    }

    //generating token for reset
    const token = crypto.randomBytes(24).toString('hex');
    employee.resetPasswordToken = token;
    employee.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await employee.save({session});

    await AuditLog.create([{
      employeeId: employee._id,
      action: 'password-reset-request',
      details: 'Password reset requested',
    }], {session});

    await session.commitTransaction();

    res.json({
      message: 'Password reset token generated. Use the token to reset your password.',
      resetToken: token,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ error: error.message });
  } finally {
    session.endSession();
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  const session = await Employee.startSession();
  session.startTransaction();

  try {
    const { token, password } = req.body;
    if (!isNonEmptyString(token) || !isValidPassword(password)) {
      await session.abortTransaction();
      return sendError(res, 400, 'Valid token and a new password of at least 8 characters are required');
    }

    const employee = await Employee.findOne({
      resetPasswordToken: token.trim(),
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!employee) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    //after reset
    employee.password = password;
    employee.resetPasswordToken = undefined;
    employee.resetPasswordExpires = undefined;
    await employee.save({session});

    //log action
    await AuditLog.create([{
      employeeId: employee._id,
      action: 'password-reset',
      details: 'Password reset completed',
    }], {session});

    await session.commitTransaction();
    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {

    await session.abortTransaction();
    res.status(500).json({ error: error.message });
  } finally {
    session.endSession();
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

export default router;
