const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'clock-in', 'clock-out',
      'tea-break-out', 'tea-break-in', 'lunch-break-out', 'lunch-break-in',
      'client-visit-out', 'client-visit-in',
      'safety-drill-out', 'safety-drill-in',
    ],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  location: {
    latitude: Number,
    longitude: Number,
  },
  faceRecognitionData: {
    verified: Boolean,
    confidence: Number,
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Attendance', attendanceSchema);
