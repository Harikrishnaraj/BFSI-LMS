import type { RequestHandler } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import { verifyWebhook } from '@clerk/express/webhooks';
import { prisma } from '../services/db.js';
import { syncClerkUser, deleteClerkUser, type ClerkUserLike } from '../services/users.js';

/** POST /api/webhooks/clerk — needs the raw body, so mount before express.json(). */
export const clerkWebhook: RequestHandler = async (req, res) => {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    // Bad signature: never touch the database, and don't tell the caller why.
    res.status(400).json({ error: 'Invalid webhook signature', requestId: req.requestId });
    return;
  }

  switch (evt.type) {
    case 'user.created':
    case 'user.updated':
      await syncClerkUser(evt.data as unknown as ClerkUserLike, req.requestId);
      break;
    case 'user.deleted':
      if (evt.data.id) await deleteClerkUser(evt.data.id, req.requestId);
      break;
    default:
      break; // ignore event types we don't subscribe to yet
  }

  res.json({ received: true });
};

/** GET /api/auth/me — current user, provisioned on the spot if the webhook hasn't landed. */
export const getMe: RequestHandler = async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthenticated', requestId: req.requestId });
    return;
  }

  let user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    // Signup and the first API call can beat the webhook; pull from Clerk directly.
    const clerkUser = await clerkClient.users.getUser(userId);
    user = await syncClerkUser(clerkUser as unknown as ClerkUserLike, req.requestId);
  }

  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
};
