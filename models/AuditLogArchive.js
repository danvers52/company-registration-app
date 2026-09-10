import mongoose from 'mongoose';

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

const AuditLogArchive = mongoose.model('AuditLogArchive', auditLogArchiveSchema);
export default AuditLogArchive;
