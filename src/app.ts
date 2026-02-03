import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { DatabaseService } from './database';
import { ImageService } from './imageService';
import { PhotoRoutes } from './routes/photoRoutes';
import { errorHandler } from './middleware/errorHandler';
import config from './config';

class App {
  public app: Application;
  private db: DatabaseService;
  private imageService: ImageService;

  constructor() {
    this.app = express();
    this.db = new DatabaseService(config.dbPath);
    this.imageService = new ImageService(config.uploadDir);

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security headers with relaxed CSP for admin panel
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for admin panel
            scriptSrcAttr: ["'unsafe-inline'"], // Allow onclick handlers
            imgSrc: ["'self'", 'data:', 'blob:'],
          },
        },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      })
    );

    // CORS
    const allowedOrigins = [
      config.corsOrigin,
      'https://lovable.app',
      'https://lovable.dev',
      'https://id-preview--184c2f8c-fafa-4cd2-a826-64741c44efad.lovable.app'
    ].filter(origin => origin && origin !== '*');

    this.app.use(
      cors({
        origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
        methods: ['GET', 'POST', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        maxAge: 86400, // 24 hours
      })
    );

    // Compression
    this.app.use(
      compression({
        filter: (req, res) => {
          if (req.headers['x-no-compression']) {
            return false;
          }
          return compression.filter(req, res);
        },
        level: 6,
      })
    );

    // Request logging
    if (config.nodeEnv === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMaxRequests,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({
          status: 'error',
          message: 'Too many requests, please try again later.',
        });
      },
    });

    this.app.use('/api/', limiter);

    // Stricter rate limit for upload endpoint
    const uploadLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20, // 20 uploads per 15 minutes
      message: 'Too many uploads from this IP, please try again later.',
      skipSuccessfulRequests: false,
    });

    this.app.use('/api/upload', uploadLimiter);

    // Body parsing (JSON only for non-multipart routes)
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Trust proxy (for accurate IP detection behind reverse proxy)
    this.app.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      const stats = this.db.getStorageStats();
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        storage: {
          usedGB: parseFloat(stats.totalSizeGB.toFixed(2)),
          maxGB: config.maxStorageGB,
        },
      });
    });

    // API routes
    const photoRoutes = new PhotoRoutes(this.db, this.imageService);
    this.app.use('/api', photoRoutes.router);

    // Root endpoint
    this.app.get('/', (_req: Request, res: Response) => {
      res.json({
        message: 'Wedding Photo Upload API',
        version: '1.0.0',
        endpoints: {
          health: 'GET /health',
          upload: 'POST /api/upload',
          photos: 'GET /api/photos',
          stats: 'GET /api/stats',
        },
      });
    });

    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({
        status: 'error',
        message: 'Route not found',
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public getDatabase(): DatabaseService {
    return this.db;
  }

  public getImageService(): ImageService {
    return this.imageService;
  }

  public close(): void {
    this.db.close();
  }
}

export default App;
