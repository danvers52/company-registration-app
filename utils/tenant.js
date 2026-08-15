const Company = require('../models/Company');

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getEmailDomain(email) {
  return email?.trim().split('@')[1]?.toLowerCase();
}

async function resolveCompanyByEmail(email) {
  const domain = getEmailDomain(email);
  if (!domain) return null;
  return Company.findOne({ domain });
}

async function ensureCompanyByEmail(email) {
  const domain = getEmailDomain(email);
  if (!domain) return null;

  let company = await Company.findOne({ domain });
  if (!company) {
    company = await Company.create({
      name: domain.charAt(0).toUpperCase() + domain.slice(1),
      domain,
    });
  }

  return company;
}

async function requireCompanyForRequest(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthenticated request' });
  }

  let company = null;
  if (req.user.companyId) {
    company = await Company.findById(req.user.companyId);
  }

  if (!company && req.user.email) {
    company = await ensureCompanyByEmail(req.user.email);
  }

  if (!company) {
    return res.status(400).json({ error: 'Company not found for authenticated user' });
  }

  req.company = company;
  next();
}

function isSameCompany(employee, user) {
  if (!employee || !user) return false;
  if (employee.company && user.companyId) {
    return employee.company.toString() === user.companyId.toString();
  }
  const employeeDomain = getEmailDomain(employee.email);
  const userDomain = getEmailDomain(user.email);
  return employeeDomain && userDomain && employeeDomain === userDomain;
}

module.exports = {
  getEmailDomain,
  resolveCompanyByEmail,
  ensureCompanyByEmail,
  requireCompanyForRequest,
  isSameCompany,
};
