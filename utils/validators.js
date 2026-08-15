const mongoose = require('mongoose');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ATTENDANCE_TYPES = new Set([
  'clock-in', 'clock-out',
  'tea-break-out', 'tea-break-in',
  'lunch-break-out', 'lunch-break-in',
  'client-visit-out', 'client-visit-in',
  'safety-drill-out', 'safety-drill-in',
]);
const ROLES = new Set(['employee', 'admin']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidEmail(email) {
  return isNonEmptyString(email) && EMAIL_REGEX.test(email.trim().toLowerCase());
}

function isValidPassword(password) {
  return isNonEmptyString(password) && password.length >= 8;
}

function isValidRole(role) {
  return isNonEmptyString(role) && ROLES.has(role);
}

function isValidAttendanceType(type) {
  return isNonEmptyString(type) && ATTENDANCE_TYPES.has(type);
}

function isValidDateString(value) {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

function sendError(res, status, message, details) {
  return res.status(status).json({ error: message, details });
}

function sanitizeEmployee(employee) {
  if (!employee) return null;
  return {
    id: employee._id || employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    company: employee.company,
    department: employee.department,
    isActive: employee.isActive,
  };
}

module.exports = {
  isNonEmptyString,
  isValidEmail,
  isValidPassword,
  isValidRole,
  isValidAttendanceType,
  isValidDateString,
  isValidObjectId,
  sendError,
  sanitizeEmployee,
};
