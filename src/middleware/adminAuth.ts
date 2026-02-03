import { Request, Response, NextFunction } from 'express';
import config from '../config';
import { AppError } from './errorHandler';

/**
 * Simple admin authentication middleware using Basic Auth
 */
export const adminAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    throw new AppError(401, 'Authentication required');
  }

  // Decode Base64 credentials
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  // Check password (username can be anything)
  if (password !== config.adminPassword) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    throw new AppError(401, 'Invalid credentials');
  }

  next();
};
