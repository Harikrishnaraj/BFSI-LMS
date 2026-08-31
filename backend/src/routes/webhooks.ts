import express, { Router } from 'express';
import { clerkWebhook } from '../controllers/users.js';

export const webhookRouter = Router();

// Raw body: Svix signs the exact bytes, so re-serialised JSON fails verification.
webhookRouter.post('/webhooks/clerk', express.raw({ type: 'application/json' }), clerkWebhook);
