//Acceptance testing: santization, NoSQL injection, and file upload validation

import {
  isNonEmptyString,
  isValidEmail,
  isValidPassword,
  isValidRole,
  isValidAttendanceType,
  sanitizeEmployee
} from '../utils/validators.js';

import multer from 'multer';
import path from 'path';

// --- 1. Sanitization Tests ---
describe('sanitizeEmployee', () => {
  it('removes sensitive fields', () => {
    const employee = {
      _id: '123',
      name: 'Shanel',
      email: 'shanel@example.com',
      role: 'employee',
      company: 'TechCorp',
      department: 'Engineering',
      isActive: true,
      password: 'SecretPass',
      tokens: ['abc']
    };
    const sanitized = sanitizeEmployee(employee);
    expect(sanitized).toEqual({
      id: '123',
      name: 'Shanel',
      email: 'shanel@example.com',
      role: 'employee',
      company: 'TechCorp',
      department: 'Engineering',
      isActive: true
    });
    expect(sanitized.password).toBeUndefined();
    expect(sanitized.tokens).toBeUndefined();
  });

  it('returns null for null input', () => {
    expect(sanitizeEmployee(null)).toBeNull();
  });
});

// --- 2. NoSQL Injection Tests ---
describe('NoSQL injection attempts', () => {
  it('rejects object payloads for email', () => {
    expect(isValidEmail({ $gt: '' })).toBe(false);
  });

  it('rejects object payloads for role', () => {
    expect(isValidRole({ $ne: 'employee' })).toBe(false);
  });

  it('accepts only valid strings', () => {
    expect(isValidEmail('valid@example.com')).toBe(true);
    expect(isValidRole('admin')).toBe(true);
    expect(isNonEmptyString('hello')).toBe(true);
    expect(isNonEmptyString('')).toBe(false);
  });

  it('accepts employee restoration as an attendance type', () => {
    expect(isValidAttendanceType('restore-employee')).toBe(true);
  });
});

// --- 3. File Upload Validation (middleware test) ---
describe('File upload validation', () => {
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === '.csv' || ext === '.xlsx') {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type'), false);
      }
    },
    limits: { fileSize: 1024 * 1024 } // 1MB
  });

  it('accepts .csv files', () => {
    const file = { originalname: 'employees.csv' };
    upload.fileFilter(null, file, (err, ok) => {
      expect(err).toBeNull();
      expect(ok).toBe(true);
    });
  });

  it('rejects .exe files', () => {
    const file = { originalname: 'malware.exe' };
    upload.fileFilter(null, file, (err, ok) => {
      expect(err).toBeInstanceOf(Error);
      expect(ok).toBe(false);
    });
  });
});
