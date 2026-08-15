const express = require('express');
const jwt = require('jsonwebtoken');
const Attendance = require('../models/Attendance');
const AuditLog = require('../models/AuditLog');
const Employee = require('../models/Employee');
const {
  isValidObjectId,
  isValidAttendanceType,
  isValidDateString,
  isNonEmptyString,
  sendError,
} = require('../utils/validators');
const { jwtSecret } = require('../utils/config');
const { requireCompanyForRequest, isSameCompany } = require('../utils/tenant');
const router = express.Router();

const verifyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
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

// Record attendance
router.post('/record', verifyToken, requireCompanyForRequest, async (req, res) => {
  try {
    let { employeeId, type, timestamp, location, faceRecognitionData, notes } = req.body;

    if (!isValidAttendanceType(type)) {
      return sendError(res, 400, 'Invalid attendance type');
    }

    if (req.user.role === 'employee') {
      if (employeeId && employeeId !== req.user.id) {
        return sendError(res, 403, 'Employees can only record their own attendance');
      }
      employeeId = req.user.id;
    }

    if (req.user.role === 'admin') {
      if (!isValidObjectId(employeeId)) {
        return sendError(res, 400, 'Valid employeeId is required for admin attendance records');
      }

      const targetEmployee = await Employee.findById(employeeId);
      if (!targetEmployee) {
        return sendError(res, 404, 'Target employee not found');
      }

      if (!isSameCompany(targetEmployee, req.user)) {
        return sendError(res, 403, 'Admins can only record attendance for employees in their own company');
      }
    }

    const attendance = new Attendance({
      employeeId,
      type,
      timestamp: timestamp ? new Date(timestamp) : Date.now(),
      location,
      faceRecognitionData,
      notes,
    });

    await attendance.save();

    // Log action
    new AuditLog({
      employeeId,
      action: type,
      details: `${type} recorded`,
    }).save();

    res.status(201).json({ message: 'Attendance recorded', attendance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin adds a record for an employee
router.post('/admin/add', verifyToken, verifyAdmin, requireCompanyForRequest, async (req, res) => {
  try {
    const { employeeId, type, timestamp, location, notes } = req.body;

    if (!isValidObjectId(employeeId)) {
      return sendError(res, 400, 'Valid employeeId is required');
    }

    if (!isValidAttendanceType(type)) {
      return sendError(res, 400, 'Invalid attendance type');
    }

    const targetEmployee = await Employee.findById(employeeId);
    if (!targetEmployee) {
      return sendError(res, 404, 'Target employee not found');
    }

    if (!isSameCompany(targetEmployee, req.user)) {
      return sendError(res, 403, 'Admins can only add attendance for employees in their own company');
    }

    const attendance = new Attendance({
      employeeId,
      type,
      timestamp: timestamp || Date.now(),
      location,
      notes,
    });

    await attendance.save();

    await AuditLog.create({
      employeeId,
      action: 'add-attendance',
      details: `Admin added ${type} for ${targetEmployee.email}`,
    });

    res.status(201).json({ message: 'Attendance added by admin', attendance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin edits an existing record
router.put('/admin/edit/:id', verifyToken, verifyAdmin, requireCompanyForRequest, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, 400, 'Valid attendance record id is required');
    }

    const record = await Attendance.findById(req.params.id).populate('employeeId', 'email company');
    if (!record) {
      return sendError(res, 404, 'Record not found');
    }

    if (!isSameCompany(record.employeeId, req.user)) {
      return sendError(res, 403, 'Admins can only edit attendance records for their own company');
    }

    const updates = req.body;
    if (updates.type && !isValidAttendanceType(updates.type)) {
      return sendError(res, 400, 'Invalid attendance type');
    }

    if (updates.timestamp && !isValidDateString(updates.timestamp)) {
      return sendError(res, 400, 'Invalid timestamp');
    }

    const updated = await Attendance.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );

    await AuditLog.create({
      employeeId: updated.employeeId,
      action: 'edit-attendance',
      details: `Admin edited record ${req.params.id}`,
    });

    res.json({ message: 'Attendance updated', updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin deletes a record: change end
router.delete('/admin/delete/:id', verifyToken, verifyAdmin, requireCompanyForRequest, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, 400, 'Valid attendance record id is required');
    }

    const record = await Attendance.findById(req.params.id).populate('employeeId', 'email company');
    if (!record) {
      return sendError(res, 404, 'Record not found');
    }

    if (!isSameCompany(record.employeeId, req.user)) {
      return sendError(res, 403, 'Admins can only delete attendance records for their own company');
    }

    const deleted = await Attendance.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      employeeId: deleted.employeeId,
      action: 'delete-attendance',
      details: `Admin deleted record ${req.params.id}`,
    });

    res.json({ message: 'Attendance deleted', deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance history for employee
router.get('/history', verifyToken, async (req, res) => {
  try {
    const records = await Attendance.find({ employeeId: req.user.id })
      .populate('employeeId', 'name email role')
      .sort({ timestamp: -1 })
      .limit(50);

    res.json({ records });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance for a specific date
router.get('/date/:date', verifyToken, async (req, res) => {
  try {
    if (!isValidDateString(req.params.date)) {
      return sendError(res, 400, 'Valid date is required as YYYY-MM-DD');
    }

    const startDate = new Date(req.params.date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const records = await Attendance.find({
      employeeId: req.user.id,
      timestamp: { $gte: startDate, $lt: endDate },
    })
      .populate('employeeId', 'name email role')
      .sort({ timestamp: 1 });

    res.json({ records });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all attendance records (Admin only)
router.get('/admin/all', verifyToken, verifyAdmin, requireCompanyForRequest, async (req, res) => {
  try {
    const companyEmployees = await Employee.find({ company: req.company._id }, '_id').lean();
    const employeeIds = companyEmployees.map((employee) => employee._id);

    const query = { employeeId: { $in: employeeIds } };
    if (req.query.date) {
      const startDate = new Date(req.query.date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      query.timestamp = { $gte: startDate, $lt: endDate };
    }

    const records = await Attendance.find(query)
      .populate({
        path: 'employeeId',
        select: 'name email role company',
      })
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();

    res.json({ records: records.filter(record => record.employeeId) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
