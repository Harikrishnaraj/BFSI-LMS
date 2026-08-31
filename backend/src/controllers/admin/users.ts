import type { RequestHandler } from 'express';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../../services/db.js';
import { auditContext, writeAudit } from '../../services/audit.js';
import { hashPassword } from '../../utils/password.js';
import { parsePage } from '../../utils/pagination.js';

const ROLES: Role[] = ['admin', 'instructor', 'learner'];
const isRole = (v: unknown): v is Role => ROLES.includes(v as Role);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const badRequest = (res: Parameters<RequestHandler>[1], requestId: string, message: string) =>
  res.status(400).json({ error: message, requestId });

/** Never returns password_hash — it must not leave the database layer. */
const PUBLIC_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  department: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const listUsers: RequestHandler = async (req, res) => {
  const { page, pageSize, skip } = parsePage(req.query as Record<string, unknown>);
  const { role, department, search, isActive } = req.query as Record<string, string | undefined>;

  if (role && !isRole(role)) return void badRequest(res, req.requestId, `Unknown role: ${role}`);

  const where: Prisma.UserWhereInput = {
    ...(isRole(role) ? { role } : {}),
    ...(department ? { department: { equals: department, mode: 'insensitive' } } : {}),
    ...(isActive === undefined ? {} : { isActive: isActive === 'true' }),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: PUBLIC_FIELDS,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
};

export const getUser: RequestHandler = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: String(req.params.id) },
    select: PUBLIC_FIELDS,
  });

  if (!user) return void res.status(404).json({ error: 'User not found', requestId: req.requestId });
  res.json(user);
};

/**
 * Creates the local user row. The account still has to exist in Clerk for the
 * person to sign in — this returns a temporary password for the invite flow
 * rather than provisioning Clerk itself.
 */
export const createUser: RequestHandler = async (req, res) => {
  const { email, name, role, department, sendWelcomeEmail } = (req.body ?? {}) as Record<string, unknown>;

  if (typeof email !== 'string' || !EMAIL.test(email))
    return void badRequest(res, req.requestId, 'A valid email is required');
  if (typeof name !== 'string' || !name.trim())
    return void badRequest(res, req.requestId, 'Name is required');
  if (!isRole(role)) return void badRequest(res, req.requestId, 'Role must be admin, instructor or learner');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await writeAudit({
      ...auditContext(req),
      userId: req.user?.dbId,
      action: 'admin.user.create',
      status: 'failure',
      errorMessage: 'Email already exists',
      details: { email },
    });
    return void res.status(400).json({ error: 'A user with that email exists', requestId: req.requestId });
  }

  const temporaryPassword = generateTemporaryPassword();
  const user = await prisma.user.create({
    data: {
      email,
      name: name.trim(),
      role,
      department: typeof department === 'string' && department ? department : null,
      passwordHash: await hashPassword(temporaryPassword),
    },
    select: PUBLIC_FIELDS,
  });

  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'admin.user.create',
    resourceType: 'user',
    resourceId: user.id,
    // ponytail: the welcome email isn't sent yet — recorded so the trail shows
    // what the admin asked for once a mail provider is wired in.
    details: { email: user.email, role: user.role, sendWelcomeEmail: sendWelcomeEmail !== false },
  });

  res.status(201).json({ ...user, temporaryPassword });
};

export const updateUser: RequestHandler = async (req, res) => {
  const { name, department, isActive, role } = (req.body ?? {}) as Record<string, unknown>;

  if (name !== undefined && (typeof name !== 'string' || !name.trim()))
    return void badRequest(res, req.requestId, 'Name cannot be empty');
  if (role !== undefined && !isRole(role))
    return void badRequest(res, req.requestId, 'Role must be admin, instructor or learner');

  const existing = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!existing)
    return void res.status(404).json({ error: 'User not found', requestId: req.requestId });

  const user = await prisma.user.update({
    where: { id: String(req.params.id) },
    data: {
      ...(name !== undefined ? { name: (name as string).trim() } : {}),
      ...(department !== undefined ? { department: (department as string) || null } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      ...(role !== undefined && isRole(role) ? { role } : {}),
    },
    select: PUBLIC_FIELDS,
  });

  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'admin.user.update',
    resourceType: 'user',
    resourceId: user.id,
    // Recording both sides makes the trail answer "what changed" on its own.
    details: {
      before: { name: existing.name, department: existing.department, isActive: existing.isActive, role: existing.role },
      after: { name: user.name, department: user.department, isActive: user.isActive, role: user.role },
    },
  });

  res.json(user);
};

export const deactivateUser: RequestHandler = async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!existing)
    return void res.status(404).json({ error: 'User not found', requestId: req.requestId });

  const user = await prisma.user.update({
    where: { id: String(req.params.id) },
    data: { isActive: false },
    select: PUBLIC_FIELDS,
  });

  await writeAudit({
    ...auditContext(req),
    userId: req.user?.dbId,
    action: 'admin.user.deactivate',
    resourceType: 'user',
    resourceId: user.id,
    details: { email: user.email },
  });

  res.json(user);
};

/** Temporary credential for the invite email; the user must change it on first login. */
const generateTemporaryPassword = (): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `Tmp-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}!`;
};
