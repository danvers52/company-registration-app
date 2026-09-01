import mongoose from 'mongoose';

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
      'safety-drill-out', 'safety-drill-in',
      'password-reset', 'password-reset-request',
    ],
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

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// Database indexes for performance
auditLogSchema.index({ employeeId: 1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ employeeId: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1, action: 1 });

export default AuditLog;