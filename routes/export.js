const express = require('express');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');
const { getAuditLogsForMonth } = require('../utils/auditArchival');
const { jwtSecret } = require('../utils/config');
const { requireCompanyForRequest } = require('../utils/tenant');

const router = express.Router();

const escapeRegExp = (text) => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

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

const sendExcel = (res, workbook, filename) => {
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
};

router.get('/employees', verifyToken, requireCompanyForRequest, verifyAdmin, async (req, res) => {
  try {
    const employees = await Employee.find(
      { company: req.company._id },
      '-password'
    ).sort({ name: 1 }).lean();

    const rows = employees.map((employee, index) => ({
      'No.': index + 1,
      Name: employee.name || '',
      Email: employee.email || '',
      Role: employee.role || 'employee',
      Department: employee.department || '',
      Active: employee.isActive ? 'Yes' : 'No',
      Created: employee.createdAt ? new Date(employee.createdAt).toLocaleString() : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 20 },
      { wch: 30 },
      { wch: 12 },
      { wch: 20 },
      { wch: 10 },
      { wch: 25 }
    ];

    sendExcel(res, workbook, 'employees.xlsx');
  } catch (error) {
    console.error('Export employees error:', error);
    res.status(500).json({ error: 'Failed to export employees', message: error.message });
  }
});

router.get('/audit', verifyToken, requireCompanyForRequest, verifyAdmin, async (req, res) => {
  try {
    const month = req.query.month;
    const logs = await getAuditLogsForMonth(month, req.company._id);

    const rows = logs.map((log, index) => ({
      'No.': index + 1,
      Timestamp: log.timestamp ? new Date(log.timestamp).toLocaleString() : '',
      Action: log.action || '',
      Details: log.details || '',
      User: log.userName || (log.employeeId && typeof log.employeeId === 'object'
        ? `${log.employeeId.name || ''} (${log.employeeId.email || ''})`
        : ''),
      Role: log.userRole || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Log');
    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 25 },
      { wch: 20 },
      { wch: 40 },
      { wch: 35 }
    ];

    sendExcel(res, workbook, 'audit-log.xlsx');
  } catch (error) {
    console.error('Export audit log error:', error);
    res.status(500).json({ error: 'Failed to export audit log', message: error.message });
  }
});

module.exports = router;
