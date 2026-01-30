import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  nodeEnv: string;
  port: number;
  host: string;
  corsOrigin: string;
  maxFileSize: number;
  maxStorageGB: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  uploadDir: string;
  dbPath: string;
  compressionQuality: number;
  maxImageWidth: number;
  maxImageHeight: number;
}

const config: Config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB default
  maxStorageGB: parseInt(process.env.MAX_STORAGE_GB || '50', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  dbPath: process.env.DB_PATH || './data/wedding_photos.db',
  compressionQuality: parseInt(process.env.COMPRESSION_QUALITY || '82', 10), // Optimized for web
  maxImageWidth: parseInt(process.env.MAX_IMAGE_WIDTH || '4096', 10),
  maxImageHeight: parseInt(process.env.MAX_IMAGE_HEIGHT || '4096', 10),
};

export default config;
