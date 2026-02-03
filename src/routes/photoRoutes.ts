import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import { DatabaseService } from '../database';
import { ImageService } from '../imageService';
import { asyncHandler, validateRequest, AppError } from '../middleware/errorHandler';
import { StorageMiddleware } from '../middleware/storage';
import { adminAuth } from '../middleware/adminAuth';
import config from '../config';
import path from 'path';

// Configure multer for memory storage (we'll process before saving)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSize,
    files: 10,
  },
  // No fileFilter - we do deep validation with magic bytes in imageService
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
      upload.any(),
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

    // Get total photo count
    this.router.get(
      '/count',
      asyncHandler(this.getCount.bind(this))
    );

    // Admin panel - protected by Basic Auth
    this.router.get(
      '/admin',
      adminAuth,
      asyncHandler(this.getAdminPanel.bind(this))
    );

    // Delete photo (admin endpoint - protected)
    this.router.delete(
      '/photos/:id',
      adminAuth,
      asyncHandler(this.deletePhoto.bind(this))
    );
  }

  private async uploadPhoto(req: Request, res: Response): Promise<void> {
    const files = (req.files as Express.Multer.File[]) || [];
    
    if (files.length === 0) {
      throw new AppError(400, 'No image files provided');
    }

    if (files.length > 10) {
      throw new AppError(400, 'Maximum 10 images allowed per upload');
    }

    const { guestName, caption } = req.body;

    // Get client IP (handle proxy headers)
    const ipAddress = (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.socket.remoteAddress ||
      ''
    ).split(',')[0].trim();

    // Process all images
    const uploadedPhotos = [];
    
    for (const file of files) {
      // Process and compress image
      const processedImage = await this.imageService.processImage(
        file.buffer,
        file.originalname
      );

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

      uploadedPhotos.push({
        id: photo.id,
        uploadedAt: photo.uploadedAt,
        filename: photo.filename,
        width: photo.width,
        height: photo.height,
      });
    }

    res.status(201).json({
      status: 'success',
      message: `${uploadedPhotos.length} photo(s) uploaded successfully`,
      data: {
        photos: uploadedPhotos,
        count: uploadedPhotos.length,
      },
    });
  }

  private async getPhotos(req: Request, res: Response): Promise<void> {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const photos = this.db.getAllPhotos(limit, offset);
    const totalCount = this.db.getPhotoCount();

    // Cache for 30 seconds
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');

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
    const photos = this.db.getAllPhotos(16, 0);

    // Cache for 30 seconds - balance between freshness and performance
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');

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

    // Cache metadata for 5 minutes
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');

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

  private async getCount(_req: Request, res: Response): Promise<void> {
    const count = this.db.getPhotoCount();

    // Cache for 30 seconds
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');

    res.json({
      status: 'success',
      data: {
        count,
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

  private async getAdminPanel(_req: Request, res: Response): Promise<void> {
    const photos = this.db.getAllPhotos(1000, 0); // Get up to 1000 photos
    const stats = this.db.getStorageStats();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wedding Photos Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header h1 { color: #333; margin-bottom: 10px; }
    .stats {
      display: flex;
      gap: 20px;
      margin-top: 15px;
      flex-wrap: wrap;
    }
    .stat {
      background: #f8f9fa;
      padding: 10px 15px;
      border-radius: 6px;
      border-left: 3px solid #007bff;
    }
    .stat-label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .stat-value { font-size: 20px; font-weight: bold; color: #333; }
    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }
    .photo-card {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      transition: transform 0.2s;
    }
    .photo-card:hover { transform: translateY(-4px); }
    .photo-img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      cursor: pointer;
    }
    .photo-info {
      padding: 12px;
    }
    .photo-meta {
      font-size: 12px;
      color: #666;
      margin: 4px 0;
    }
    .photo-caption {
      margin: 8px 0;
      color: #333;
      font-size: 14px;
    }
    .delete-btn {
      width: 100%;
      padding: 8px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin-top: 8px;
    }
    .delete-btn:hover { background: #c82333; }
    .delete-btn:disabled { background: #ccc; cursor: not-allowed; }
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 1000;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .modal.active { display: flex; }
    .modal-img {
      max-width: 90%;
      max-height: 90vh;
      object-fit: contain;
    }
    .modal-close {
      position: absolute;
      top: 20px;
      right: 40px;
      color: white;
      font-size: 40px;
      cursor: pointer;
    }
    .empty {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 Wedding Photos Admin</h1>
    <div class="stats">
      <div class="stat">
        <div class="stat-label">Total Photos</div>
        <div class="stat-value">${stats.totalFiles}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Storage Used</div>
        <div class="stat-value">${stats.totalSizeGB.toFixed(2)} GB</div>
      </div>
      <div class="stat">
        <div class="stat-label">Storage Limit</div>
        <div class="stat-value">${config.maxStorageGB} GB</div>
      </div>
      <div class="stat">
        <div class="stat-label">Percentage Used</div>
        <div class="stat-value">${((stats.totalSizeGB / config.maxStorageGB) * 100).toFixed(1)}%</div>
      </div>
    </div>
  </div>

  ${photos.length === 0 ? '<div class="empty"><h2>No photos uploaded yet</h2></div>' : `
  <div class="gallery">
    ${photos.map(photo => `
      <div class="photo-card" id="card-${photo.id}">
        <img 
          src="/api/photos/${photo.id}/file" 
          alt="${photo.caption || 'Photo'}"
          class="photo-img"
          onclick="openModal('/api/photos/${photo.id}/file')"
          loading="lazy"
        />
        <div class="photo-info">
          ${photo.guestName ? `<div class="photo-meta"><strong>👤 ${photo.guestName}</strong></div>` : ''}
          ${photo.caption ? `<div class="photo-caption">${photo.caption}</div>` : ''}
          <div class="photo-meta">📅 ${new Date(photo.uploadedAt).toLocaleString()}</div>
          <div class="photo-meta">📏 ${photo.width}×${photo.height} • ${(photo.fileSize / 1024 / 1024).toFixed(2)} MB</div>
          <div class="photo-meta">🆔 ID: ${photo.id}</div>
          <button class="delete-btn" onclick="deletePhoto(${photo.id})">🗑️ Delete Photo</button>
        </div>
      </div>
    `).join('')}
  </div>
  `}

  <div class="modal" id="modal" onclick="closeModal()">
    <span class="modal-close">&times;</span>
    <img id="modal-img" class="modal-img" src="" alt="Full size">
  </div>

  <script>
    function openModal(src) {
      document.getElementById('modal').classList.add('active');
      document.getElementById('modal-img').src = src;
    }

    function closeModal() {
      document.getElementById('modal').classList.remove('active');
      document.getElementById('modal-img').src = '';
    }

    async function deletePhoto(id) {
      if (!confirm('Are you sure you want to delete this photo? This cannot be undone.')) {
        return;
      }

      const btn = event.target;
      btn.disabled = true;
      btn.textContent = 'Deleting...';

      try {
        const response = await fetch('/api/photos/' + id, {
          method: 'DELETE',
          headers: {
            'Authorization': getAuthHeader()
          }
        });

        if (response.ok) {
          document.getElementById('card-' + id).remove();
          alert('Photo deleted successfully');
          location.reload(); // Refresh to update stats
        } else {
          const data = await response.json();
          alert('Error: ' + (data.message || 'Failed to delete'));
          btn.disabled = false;
          btn.textContent = '🗑️ Delete Photo';
        }
      } catch (error) {
        alert('Network error: ' + error.message);
        btn.disabled = false;
        btn.textContent = '🗑️ Delete Photo';
      }
    }

    function getAuthHeader() {
      // Extract Basic Auth from current page request
      return document.cookie.includes('auth') ? 
        localStorage.getItem('auth') : 
        btoa('admin:' + prompt('Enter admin password:'));
    }

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>
    `.trim();

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}

