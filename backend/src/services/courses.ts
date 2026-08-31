import type { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { redis } from './redis.js';

const LIST_CACHE_PREFIX = 'courses:list:';
const TTL_SECONDS = 300; // 5 minutes

export const COURSE_SUMMARY = {
  id: true,
  title: true,
  description: true,
  category: true,
  status: true,
  isMandatory: true,
  complianceType: true,
  targetAudience: true,
  difficulty: true,
  version: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, name: true, email: true } },
  _count: { select: { enrollments: true, content: true } },
} satisfies Prisma.CourseSelect;

export const cacheKey = (parts: Record<string, unknown>): string =>
  LIST_CACHE_PREFIX + JSON.stringify(parts);

export const readList = async <T>(key: string): Promise<T | null> => {
  try {
    const hit = await redis.get(key);
    return hit ? (JSON.parse(hit) as T) : null;
  } catch (err) {
    console.error('[courses] cache read failed', err);
    return null;
  }
};

export const writeList = async (key: string, value: unknown): Promise<void> => {
  try {
    await redis.set(key, JSON.stringify(value), { EX: TTL_SECONDS });
  } catch (err) {
    console.error('[courses] cache write failed', err);
  }
};

/**
 * Any course mutation invalidates every cached list, since a change can move a
 * course in or out of any filter combination.
 */
export const invalidateCourseLists = async (): Promise<void> => {
  try {
    const keys = await redis.keys(`${LIST_CACHE_PREFIX}*`);
    if (keys.length) await redis.del(keys);
  } catch (err) {
    console.error('[courses] cache invalidation failed', err);
  }
};
