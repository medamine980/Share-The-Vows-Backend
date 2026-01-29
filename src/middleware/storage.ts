import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../database';
import config from '../config';
import { AppError } from './errorHandler';

export class StorageMiddleware {
  constructor(private db: DatabaseService) {}

  checkStorageLimit = (req: Request, _res: Response, next: NextFunction): void => {
    const stats = this.db.getStorageStats();
    
    if (stats.totalSizeGB >= config.maxStorageGB) {
      next(new AppError(507, 'Storage limit exceeded. Maximum storage capacity reached.'));
      return;
    }

    // Check if this upload would exceed the limit
    const fileSize = req.file?.size || 0;
    const projectedSize = (stats.totalSizeBytes + fileSize) / (1024 * 1024 * 1024);
    
    if (projectedSize > config.maxStorageGB) {
      next(new AppError(507, 'Upload would exceed storage limit.'));
      return;
    }

    next();
  };
}
