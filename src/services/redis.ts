import { createClient } from 'redis';
import { env } from '../utils/env.js';

export const redis = createClient({ url: env.REDIS_URL });

redis.on('error', (err) => console.error('[redis]', err));

// ponytail: single shared connection, used for cache + session data.
// Split into separate clients only if you start using blocking commands or pub/sub.
export const connectRedis = () => redis.connect();
