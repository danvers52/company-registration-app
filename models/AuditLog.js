const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
  },
  action: {
    type: String,
    enum: [
      'login', 'logout', 'add-employee', 'remove-employee', 'edit-profile', 
      'clock-in', 'clock-out',
      'tea-break-out', 'tea-break-in', 'lunch-break-out', 'lunch-break-in',
      'client-visit-out', 'client-visit-in',
      'safety-drill-out', 'safety-drill-in',],
    required: true,
  },
  details: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
  ipAddress: String,
  userAgent: String,
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
