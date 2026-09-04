import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import AuditLogArchive from '../models/AuditLogArchive.js';

const ARCHIVE_AFTER_MONTHS = 5;

export const getArchiveCutoffDate = () => {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - ARCHIVE_AFTER_MONTHS);
  return cutoff;
}

export const getMonthRange = (month) => {
  if (!month) {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { start, end };
  }

  const [year, monthValue] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthValue - 1, 1));
  const end = new Date(Date.UTC(year, monthValue, 1));
  return { start, end };
}

export const archiveOldAuditLogs = async () => {
  const cutoffDate = getArchiveCutoffDate();
  const oldLogs = await AuditLog.find({ timestamp: { $lt: cutoffDate } }).lean();

  if (!oldLogs.length) {
    return { moved: 0 };
  }

  const archiveDocs = oldLogs.map((log) => ({
    ...log,
    _id: log._id,
  }));

  await AuditLogArchive.insertMany(archiveDocs, { ordered: false });
  await AuditLog.deleteMany({ _id: { $in: oldLogs.map((log) => log._id) } });

  return { moved: oldLogs.length };
}

export const attachAuditUserFields = (log) => ({
  ...log,
  userName: log.employeeId?.name || null,
  userEmail: log.employeeId?.email || null,
  userRole: log.employeeId?.role || null,
});

export const isObjectIdLike = (value) => {
  return value && mongoose.Types.ObjectId.isValid(value);
}

export const populateAuditQuery = (query) => {
  return query.populate({
    path: 'employeeId',
    select: 'name email role company',
  });
}

export const filterAuditLogs = (logs, companyIdOrDomain, hasObjectId) => {
  if (!companyIdOrDomain) return logs;
  if (!hasObjectId) return [];

  return logs.filter(log => log.employeeId && (
    log.employeeId.company?.toString() === companyIdOrDomain.toString()
  ));
}

export const getAuditLogsForCompany = async (companyIdOrDomain) => {
  const hasObjectId = isObjectIdLike(companyIdOrDomain);
  let query = AuditLog.find().sort({ timestamp: -1 });

  if (companyIdOrDomain) {
    query = populateAuditQuery(query, hasObjectId);
  }

  const logs = await query.lean();
  return filterAuditLogs(logs, companyIdOrDomain, hasObjectId)
    .map(attachAuditUserFields);
}

export const getArchivedAuditLogsForCompany = async (companyIdOrDomain) => {
  const hasObjectId = isObjectIdLike(companyIdOrDomain);
  let query = AuditLogArchive.find().sort({ timestamp: -1 });

  if (companyIdOrDomain) {
    query = populateAuditQuery(query, hasObjectId);
  }

  const logs = await query.lean();
  return filterAuditLogs(logs, companyIdOrDomain, hasObjectId)
    .map(attachAuditUserFields);
}

export const getAuditLogsForMonth = async (month, companyIdOrDomain) => {
  const { start, end } = getMonthRange(month);
  const hasObjectId = isObjectIdLike(companyIdOrDomain);

  let activeQuery = AuditLog.find({
    timestamp: { $gte: start, $lt: end },
  }).sort({ timestamp: -1 });

  let archivedQuery = AuditLogArchive.find({
    timestamp: { $gte: start, $lt: end },
  }).sort({ timestamp: -1 });

  if (companyIdOrDomain) {
    activeQuery = populateAuditQuery(activeQuery);
    archivedQuery = populateAuditQuery(archivedQuery);
  }

  const activeLogs = await activeQuery.lean();
  const archivedLogs = await archivedQuery.lean();

  return [...filterAuditLogs(activeLogs, companyIdOrDomain, hasObjectId),
    ...filterAuditLogs(archivedLogs, companyIdOrDomain, hasObjectId)]
    .map(attachAuditUserFields)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export const getArchivedAuditLogsForMonth = async (month, companyIdOrDomain) => {
  const { start, end } = getMonthRange(month);

  let query = AuditLogArchive.find({
    timestamp: { $gte: start, $lt: end },
  });

  const hasObjectId = companyIdOrDomain && mongoose.Types.ObjectId.isValid(companyIdOrDomain);

  if (companyIdOrDomain) {
    query = populateAuditQuery(query);
  }

  const logs = await query.sort({ timestamp: -1 }).lean();
  return filterAuditLogs(logs, companyIdOrDomain, hasObjectId).map(attachAuditUserFields);
}

export default {
  ARCHIVE_AFTER_MONTHS,
  archiveOldAuditLogs,
  getAuditLogsForMonth,
  getAuditLogsForCompany,
  getArchivedAuditLogsForCompany,
  getArchivedAuditLogsForMonth,
  getMonthRange,
};
