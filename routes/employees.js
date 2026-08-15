const express = require('express');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');
const AuditLogArchive = require('../models/AuditLogArchive');
const { archiveOldAuditLogs, getAuditLogsForMonth, getArchivedAuditLogsForMonth } = require('../utils/auditArchival');
const { jwtSecret } = require('../utils/config');
const { requireCompanyForRequest, isSameCompany } = require('../utils/tenant');
const router = express.Router();

const escapeRegExp = (text) => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

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

// Middleware to verify admin
const verifyAdmin = (req, res, next) => {
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
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (!isSameCompany(employee, req.user)) {
      return res.status(403).json({ error: 'Cannot remove employee from another company' });
    }

    await Employee.findByIdAndDelete(req.params.id);

    // Log action
    new AuditLog({
      employeeId: req.user.id,
      action: 'remove-employee',
      details: `Removed employee: ${employee.name}`,
    }).save();

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
