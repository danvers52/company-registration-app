import express from 'express';
import jwt from 'jsonwebtoken';
import Employee from '../models/Employee.js';
import ArchivedEmployee from '../models/ArchivedEmployee.js';
import Attendance from '../models/Attendance.js';
import AuditLog from '../models/AuditLog.js';
import AuditLogArchive from '../models/AuditLogArchive.js';

import {archiveOldAuditLogs, getAuditLogsForMonth, getArchivedAuditLogsForMonth, getAuditLogsForCompany, getArchivedAuditLogsForCompany} from '../utils/auditArchival.js';

import config from '../utils/config.js';
const {jwtSecret} = config;

import {requireCompanyForRequest, isSameCompany} from '../utils/tenant.js';
const router = express.Router();

export const escapeRegExp = (text) => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

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

// Middleware to verify admin
export const verifyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get all employees (Admin only)
router.get('/', verifyToken, requireCompanyForRequest, verifyAdmin, async (req, res) => {
  try {
    const employees = await Employee.find(
      { company: req.company._id },
      '-password'
    ).sort({ name: 1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get archived employees (Admin only)
router.get('/archive/employees', verifyToken, requireCompanyForRequest, verifyAdmin, async (req, res) => {
  try {
    const employees = await ArchivedEmployee.find({ company: req.company._id })
      .select('-password -resetPasswordToken')
      .sort({ archivedAt: -1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get audit logs (Admin only) - MUST be before /:id route
router.get('/audit', verifyToken, requireCompanyForRequest, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await archiveOldAuditLogs();

    const month = req.query.month;
    const logs = month
      ? await getAuditLogsForMonth(month, req.company._id)
      : await getAuditLogsForCompany(req.company._id);

    res.json(logs);
  } catch (error) {
    console.error('Audit log error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs', message: error.message });
  }
});

// Debug endpoint: count active and archived audit logs for a specific employee email
router.get('/audit/check', verifyToken, requireCompanyForRequest, verifyAdmin, async (req, res) => {
  try {
    const email = (req.query.email || '').toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ error: 'Query parameter email is required' });
    }

    const activeLogs = await AuditLog.find()
      .populate({
        path: 'employeeId',
        select: 'name email role company',
        match: { email, company: req.company._id },
      })
      .lean();

    const archivedLogs = await AuditLogArchive.find()
      .populate({
        path: 'employeeId',
        select: 'name email role company',
        match: { email, company: req.company._id },
      })
      .lean();

    const activeFiltered = activeLogs.filter(log => log.employeeId);
    const archivedFiltered = archivedLogs.filter(log => log.employeeId);

    res.json({
      email,
      activeCount: activeFiltered.length,
      archivedCount: archivedFiltered.length,
      activeSample: activeFiltered.slice(0, 10),
      archivedSample: archivedFiltered.slice(0, 10),
    });
  } catch (error) {
    console.error('Audit check error:', error);
    res.status(500).json({ error: 'Failed to inspect audit logs', message: error.message });
  }
});

router.get('/audit/archive', verifyToken, requireCompanyForRequest, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const month = req.query.month;
    const logs = month
      ? await getArchivedAuditLogsForMonth(month, req.company._id)
      : await getArchivedAuditLogsForCompany(req.company._id);

    res.json(logs);
  } catch (error) {
    console.error('Archived audit log error:', error);
    res.status(500).json({ error: 'Failed to fetch archived audit logs', message: error.message });
  }
});

router.post('/audit/archive/trigger', verifyToken, requireCompanyForRequest, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await archiveOldAuditLogs();
    res.json({ message: 'Archive check completed', moved: result.moved });
  } catch (error) {
    console.error('Archive trigger error:', error);
    res.status(500).json({ error: 'Failed to archive audit logs', message: error.message });
  }
});

// Get employee by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id, '-password');
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (req.user.role === 'admin' && !isSameCompany(employee, req.user)) {
      return res.status(403).json({ error: 'Cannot access employee from another company' });
    }

    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update employee profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    // Check if user is updating their own profile or is admin
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (req.user.role === 'admin') {
      const employee = await Employee.findById(req.params.id);
      if (employee && !isSameCompany(employee, req.user)) {
        return res.status(403).json({ error: 'Cannot update employee from another company' });
      }
    }

    const { name, department, profilePicture } = req.body;
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { name, department, profilePicture, updatedAt: Date.now() },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Log action
    new AuditLog({
      employeeId: req.user.id,
      action: 'edit-profile',
      details: `Updated profile for employee: ${employee.name}`,
    }).save();

    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete employee (Admin only)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  const session = await Employee.startSession();
  session.startTransaction();
  try {
    const employee = await Employee.findById(req.params.id).session(session);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (!isSameCompany(employee, req.user)) {
      return res.status(403).json({ error: 'Cannot remove employee from another company' });
    }

    await ArchivedEmployee.create([{
      originalEmployeeId: employee._id,
      name: employee.name,
      email: employee.email,
      password: employee.password,
      role: employee.role,
      company: employee.company,
      department: employee.department,
      profilePicture: employee.profilePicture,
      resetPasswordToken: employee.resetPasswordToken,
      resetPasswordExpires: employee.resetPasswordExpires,
      isActive: employee.isActive,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
      archivedBy: req.user.id,
    }], { session });
    await Employee.deleteOne({ _id: req.params.id }, { session });

    // Log action
    await AuditLog.create([{
      employeeId: req.user.id,
      action: 'remove-employee',
      details: `Archived employee: ${employee.name}`,
    }], { session });

    await session.commitTransaction();
    res.json({ message: 'Employee archived successfully' });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ error: error.message });
  } finally {
    session.endSession();
  }
});

// Restore an archived employee (Admin only)
router.post('/archive/employees/:id/restore', verifyToken, verifyAdmin, requireCompanyForRequest, async (req, res) => {
  const session = await Employee.startSession();
  session.startTransaction();
  try {
    const archived = await ArchivedEmployee.findOne({ _id: req.params.id, company: req.company._id }).session(session);
    if (!archived) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Archived employee not found' });
    }
    if (await Employee.exists({ email: archived.email })) {
      await session.abortTransaction();
      return res.status(409).json({ error: 'An active employee already uses this email' });
    }

    await Employee.collection.insertOne({
      _id: archived.originalEmployeeId,
      name: archived.name,
      email: archived.email,
      password: archived.password,
      role: archived.role,
      company: archived.company,
      department: archived.department,
      profilePicture: archived.profilePicture,
      resetPasswordToken: archived.resetPasswordToken,
      resetPasswordExpires: archived.resetPasswordExpires,
      isActive: archived.isActive,
      createdAt: archived.createdAt,
      updatedAt: archived.updatedAt,
    }, { session });
    await Attendance.create([{
      employeeId: archived.originalEmployeeId,
      type: 'restore-employee',
      timestamp: new Date(),
      notes: 'Employee restored from archive',
    }], { session });
    await AuditLog.create([{
      employeeId: req.user.id,
      action: 'restore-employee',
      details: `Restored employee: ${archived.name}`,
    }], { session });
    await ArchivedEmployee.deleteOne({ _id: archived._id }, { session });
    await session.commitTransaction();
    res.json({ message: 'Employee restored successfully' });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ error: error.message });
  } finally {
    session.endSession();
  }
});

// Permanently delete an archived employee (Admin only)
router.delete('/archive/employees/:id', verifyToken, verifyAdmin, requireCompanyForRequest, async (req, res) => {
  try {
    const deleted = await ArchivedEmployee.findOneAndDelete({ _id: req.params.id, company: req.company._id });
    if (!deleted) return res.status(404).json({ error: 'Archived employee not found' });
    res.json({ message: 'Archived employee permanently deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;