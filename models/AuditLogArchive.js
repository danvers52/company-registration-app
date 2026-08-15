const mongoose = require('mongoose');

const auditLogArchiveSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
  },
  action: {
    type: String,
    required: true,
  },
  details: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
  ipAddress: String,
  userAgent: String,
  archivedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('AuditLogArchive', auditLogArchiveSchema);
