import mongoose from 'mongoose';

const archivedEmployeeSchema = new mongoose.Schema({
  originalEmployeeId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['employee', 'admin'], required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  department: String,
  profilePicture: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date,
  archivedAt: { type: Date, default: Date.now },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
});

archivedEmployeeSchema.index({ company: 1, archivedAt: -1 });
archivedEmployeeSchema.index({ email: 1 });

export default mongoose.model('ArchivedEmployee', archivedEmployeeSchema);