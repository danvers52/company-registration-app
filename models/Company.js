const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  domain: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Database indexes for performance
companySchema.index({ isActive: 1 });
companySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Company', companySchema);
