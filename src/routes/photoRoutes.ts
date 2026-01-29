import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import { DatabaseService } from '../database';
import { ImageService } from '../imageService';
import { asyncHandler, validateRequest, AppError } from '../middleware/errorHandler';
import { StorageMiddleware } from '../middleware/storage';
import config from '../config';
import path from 'path';

// Configure multer for memory storage (we'll process before saving)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSize,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    // Basic MIME type check (will be validated more thoroughly later)
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowedMimes.some(_mime => file.mimetype.startsWith('image/'))) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Only image files are allowed'));
    }
  },
});

export class PhotoRoutes {
  public router: Router;
  private db: DatabaseService;
  private imageService: ImageService;
  private storageMiddleware: StorageMiddleware;

  constructor(db: DatabaseService, imageService: ImageService) {
    this.router = Router();
    this.db = db;
    this.imageService = imageService;
    this.storageMiddleware = new StorageMiddleware(db);
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Upload photo endpoint
    this.router.post(
      '/upload',
      upload.single('image'),
      [
        body('guestName')
          .optional()
          .trim()
          .isLength({ max: 100 })
          .withMessage('Guest name must be less than 100 characters')
          .escape(),
        body('caption')
          .optional()
          .trim()
          .isLength({ max: 500 })
          .withMessage('Caption must be less than 500 characters')
          .escape(),
      ],
      validateRequest,
      this.storageMiddleware.checkStorageLimit,
      asyncHandler(this.uploadPhoto.bind(this))
    );

    // Get latest 20 photos
    this.router.get(
      '/latest',
      asyncHandler(this.getLatestPhotos.bind(this))
    );

    // Get all photos (for admin/gallery view)
    this.router.get(
      '/photos',
      asyncHandler(this.getPhotos.bind(this))
    );

    // Get single photo
    this.router.get(
      '/photos/:id',
      asyncHandler(this.getPhotoById.bind(this))
    );

    // Serve photo file
    this.router.get(
      '/photos/:id/file',
      asyncHandler(this.servePhotoFile.bind(this))
    );

    // Get storage stats
    this.router.get(
      '/stats',
      asyncHandler(this.getStats.bind(this))
    );

    // Delete photo (admin endpoint - consider adding auth)
    this.router.delete(
      '/photos/:id',
      asyncHandler(this.deletePhoto.bind(this))
    );
  }

  private async uploadPhoto(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      throw new AppError(400, 'No image file provided');
    }

    const { guestName, caption } = req.body;

    // Process and compress image
    const processedImage = await this.imageService.processImage(
      req.file.buffer,
      req.file.originalname
    );

    // Get client IP (handle proxy headers)
    const ipAddress = (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.socket.remoteAddress ||
      ''
    ).split(',')[0].trim();

    // Save to database
    const photo = this.db.insertPhoto({
      filename: processedImage.filename,
      originalName: processedImage.originalName,
      guestName: guestName || undefined,
      caption: caption || undefined,
      mimeType: processedImage.mimeType,
      fileSize: processedImage.fileSize,
      width: processedImage.width,
      height: processedImage.height,
      ipAddress,
    });

    res.status(201).json({
      status: 'success',
      message: 'Photo uploaded successfully',
      data: {
        id: photo.id,
        uploadedAt: photo.uploadedAt,
        filename: photo.filename,
        width: photo.width,
        height: photo.height,
      },
    });
  }

  private async getPhotos(req: Request, res: Response): Promise<void> {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const photos = this.db.getAllPhotos(limit, offset);
    const totalCount = this.db.getPhotoCount();

    res.json({
      status: 'success',
      data: {
        photos: photos.map(p => ({
          id: p.id,
          guestName: p.guestName,
          caption: p.caption,
          width: p.width,
          height: p.height,
          uploadedAt: p.uploadedAt,
          fileUrl: `/api/photos/${p.id}/file`,
        })),
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + photos.length < totalCount,
        },
      },
    });
  }

  private async getLatestPhotos(_req: Request, res: Response): Promise<void> {
    const photos = this.db.getAllPhotos(20, 0);

    res.json({
      status: 'success',
      data: {
        photos: photos.map(p => ({
          id: p.id,
          guestName: p.guestName,
          caption: p.caption,
          width: p.width,
          height: p.height,
          uploadedAt: p.uploadedAt,
          fileUrl: `/api/photos/${p.id}/file`,
        })),
      },
    });
  }

  private async getPhotoById(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      throw new AppError(400, 'Invalid photo ID');
    }

    const photo = this.db.getPhotoById(id);

    if (!photo) {
      throw new AppError(404, 'Photo not found');
    }

    res.json({
      status: 'success',
      data: {
        id: photo.id,
        guestName: photo.guestName,
        caption: photo.caption,
        width: photo.width,
        height: photo.height,
        fileSize: photo.fileSize,
        uploadedAt: photo.uploadedAt,
        fileUrl: `/api/photos/${photo.id}/file`,
      },
    });
  }

  private async servePhotoFile(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      throw new AppError(400, 'Invalid photo ID');
    }

    const photo = this.db.getPhotoById(id);

    if (!photo) {
      throw new AppError(404, 'Photo not found');
    }

    const filePath = this.imageService.getImagePath(photo.filename);

    if (!this.imageService.imageExists(photo.filename)) {
      throw new AppError(404, 'Photo file not found');
    }

    // Set appropriate headers
    res.setHeader('Content-Type', photo.mimeType);
    res.setHeader('Content-Length', photo.fileSize);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.sendFile(path.resolve(filePath));
  }

  private async getStats(_req: Request, res: Response): Promise<void> {
    const stats = this.db.getStorageStats();

    res.json({
      status: 'success',
      data: {
        totalPhotos: stats.totalFiles,
        totalSizeBytes: stats.totalSizeBytes,
        totalSizeGB: parseFloat(stats.totalSizeGB.toFixed(2)),
        maxStorageGB: config.maxStorageGB,
        percentageUsed: parseFloat(((stats.totalSizeGB / config.maxStorageGB) * 100).toFixed(2)),
      },
    });
  }

  private async deletePhoto(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      throw new AppError(400, 'Invalid photo ID');
    }

    const photo = this.db.getPhotoById(id);

    if (!photo) {
      throw new AppError(404, 'Photo not found');
    }

    // Delete from filesystem
    this.imageService.deleteImage(photo.filename);

    // Delete from database
    this.db.deletePhoto(id);

    res.json({
      status: 'success',
      message: 'Photo deleted successfully',
    });
  }
}
