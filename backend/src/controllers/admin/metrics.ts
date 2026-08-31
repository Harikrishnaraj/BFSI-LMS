import type { RequestHandler } from 'express';
import { getCourseCompliance, getDashboardMetrics } from '../../services/metrics.js';

export const dashboardMetrics: RequestHandler = async (_req, res) => {
  res.json(await getDashboardMetrics());
};

export const courseCompliance: RequestHandler = async (_req, res) => {
  res.json({ data: await getCourseCompliance() });
};
