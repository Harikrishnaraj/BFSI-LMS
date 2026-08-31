import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';
import type { AuditStatus, Prisma } from '@prisma/client';
import { prisma } from '../../services/db.js';
import { auditContext, writeAudit } from '../../services/audit.js';
import { parsePage } from '../../utils/pagination.js';
import { toCsv } from '../../utils/csv.js';

const REPORT_DIR = path.resolve(process.cwd(), 'var/reports');
const isStatus = (v: unknown): v is AuditStatus => v === 'success' || v === 'failure';

/** Rejects an unparseable date rather than silently ignoring the filter. */
const parseDate = (value: string | undefined, label: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error(`Invalid ${label}`), { status: 400 });
  return date;
};

const buildWhere = (query: Record<string, string | undefined>): Prisma.AuditLogWhereInput => {
  const { userId, action, result, startDate, endDate } = query;
  const from = parseDate(startDate, 'startDate');
  const to = parseDate(endDate, 'endDate');

  if (result && !isStatus(result)) {
    throw Object.assign(new Error("result must be 'success' or 'failure'"), { status: 400 });
  }

  return {
    ...(userId ? { userId } : {}),
    ...(action ? { action } : {}),
    ...(isStatus(result) ? { status: result } : {}),
    ...(from || to ? { timestamp: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
};

const SELECT = {
  id: true,
  userId: true,
  action: true,
  resourceType: true,
  resourceId: true,
  ipAddress: true,
  userAgent: true,
  status: true,
  errorMessage: true,
  details: true,
  requestId: true,
  timestamp: true,
  user: { select: { email: true } },
} satisfies Prisma.AuditLogSelect;

type Row = Prisma.AuditLogGetPayload<{ select: typeof SELECT }>;

/** snake_case on the way out: the trail is consumed by compliance tooling, not just this UI. */
const serialise = (row: Row) => ({
  id: row.id,
  user_id: row.userId,
  user_email: row.user?.email ?? null,
  action: row.action,
  resource_type: row.resourceType,
  resource_id: row.resourceId,
  ip_address: row.ipAddress,
  user_agent: row.userAgent,
  status: row.status,
  error_message: row.errorMessage,
  details: row.details,
  request_id: row.requestId,
  timestamp: row.timestamp.toISOString(),
});

export const listAuditLogs: RequestHandler = async (req, res) => {
  const { page, pageSize, skip } = parsePage(req.query as Record<string, unknown>, 50);
  const where = buildWhere(req.query as Record<string, string | undefined>);

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: SELECT,
      orderBy: { timestamp: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ data: rows.map(serialise), total, page, pageSize });
};

export const getAuditLog: RequestHandler = async (req, res) => {
  const row = await prisma.auditLog.findUnique({
    where: { id: String(req.params.id) },
    select: SELECT,
  });
  if (!row) return void res.status(404).json({ error: 'Audit log not found', requestId: req.requestId });
  res.json(serialise(row));
};

const EXPORT_LIMIT = 50_000;

/**
 * Generates the report synchronously and hands back a download URL. Reports are
 * capped at 50k rows.
 * ponytail: file lands on local disk, so this needs object storage (or a shared
 * volume) before the API runs on more than one instance.
 */
export const exportAuditLogs: RequestHandler = async (req, res) => {
  const { startDate, endDate, format = 'csv' } = (req.body ?? {}) as Record<string, string>;

  if (format !== 'csv') {
    return void res.status(400).json({
      error: `Unsupported format '${format}'. Only csv is implemented.`,
      requestId: req.requestId,
    });
  }

  const where = buildWhere({ startDate, endDate });
  const rows = await prisma.auditLog.findMany({
    where,
    select: SELECT,
    orderBy: { timestamp: 'desc' },
    take: EXPORT_LIMIT,
  });

  const reportId = randomUUID();
  const generatedAt = new Date().toISOString();

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(
    path.join(REPORT_DIR, `${reportId}.csv`),
    toCsv(
      rows.map(serialise).map((r) => ({ ...r, details: r.details ? JSON.stringify(r.details) : '' }))
    ),
    'utf8'
  );

  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'admin.audit.export',
    resourceType: 'report',
    resourceId: reportId,
    details: { startDate: startDate ?? null, endDate: endDate ?? null, format, rows: rows.length },
  });

  res.status(201).json({
    reportId,
    downloadUrl: `/api/admin/audit-logs/reports/${reportId}`,
    generatedAt,
    rows: rows.length,
    truncated: rows.length === EXPORT_LIMIT,
  });
};

export const downloadReport: RequestHandler = async (req, res) => {
  const reportId = String(req.params.reportId);
  // Reject anything that isn't a plain UUID: this value becomes a file path.
  if (!/^[0-9a-f-]{36}$/i.test(reportId)) {
    return void res.status(400).json({ error: 'Invalid report id', requestId: req.requestId });
  }

  const file = await readFile(path.join(REPORT_DIR, `${reportId}.csv`), 'utf8').catch(() => null);
  if (file === null) {
    return void res.status(404).json({ error: 'Report not found', requestId: req.requestId });
  }

  res.setHeader('content-type', 'text/csv; charset=utf-8');
  res.setHeader('content-disposition', `attachment; filename="audit-log-${reportId}.csv"`);
  res.send(file);
};
