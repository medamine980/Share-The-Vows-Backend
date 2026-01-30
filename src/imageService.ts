import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sanitize from 'sanitize-filename';
import { fileTypeFromBuffer } from 'file-type';
import config from './config';

export interface ProcessedImage {
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
}

export class ImageService {
  private uploadDir: string;

  constructor(uploadDir: string) {
    this.uploadDir = uploadDir;
    this.ensureUploadDirExists();
  }

  private ensureUploadDirExists(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Validate image file type from buffer
   */
  public async validateImageType(buffer: Buffer): Promise<{ valid: boolean; mimeType?: string }> {
    try {
      const fileType = await fileTypeFromBuffer(buffer);
      
      if (!fileType) {
        return { valid: false };
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      
      if (allowedTypes.includes(fileType.mime)) {
        return { valid: true, mimeType: fileType.mime };
      }

      return { valid: false };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Process and compress image with best practices
   */
  public async processImage(
    buffer: Buffer,
    originalName: string
  ): Promise<ProcessedImage> {
    // Validate file type
    const validation = await this.validateImageType(buffer);
    if (!validation.valid || !validation.mimeType) {
      throw new Error('Invalid image file type. Only JPEG, PNG, and WebP are allowed.');
    }

    // Determine output format
    const ext = path.extname(sanitize(originalName)).slice(1) || 'jpg';
    const filename = `${uuidv4()}.${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    // Process image with sharp (optimized for production)
    const image = sharp(buffer, {
      limitInputPixels: config.maxImageWidth * config.maxImageHeight * 4,
      sequentialRead: true,
      // Performance optimizations
      failOn: 'none', // Don't fail on warnings
      animated: false, // Disable animated image support for performance
    });

    // Get metadata
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    // Prepare processing pipeline
    let processedImage = image;

    // Auto-rotate based on EXIF
    processedImage = processedImage.rotate();

    // Resize if image exceeds max dimensions
    if (metadata.width > config.maxImageWidth || metadata.height > config.maxImageHeight) {
      processedImage = processedImage.resize(config.maxImageWidth, config.maxImageHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Remove EXIF data for privacy (keeps orientation)
    processedImage = processedImage.withMetadata({
      exif: {},
      icc: undefined,
    });

    // Compress based on format with production optimizations
    if (validation.mimeType === 'image/jpeg') {
      processedImage = processedImage.jpeg({
        quality: config.compressionQuality,
        progressive: true,
        mozjpeg: true,
        optimizeCoding: true,
        trellisQuantisation: true,
        overshootDeringing: true,
      });
    } else if (validation.mimeType === 'image/webp') {
      processedImage = processedImage.webp({
        quality: config.compressionQuality,
        effort: 4, // 0-6, balance between speed and compression
        smartSubsample: true,
      });
    } else if (validation.mimeType === 'image/png') {
      processedImage = processedImage.png({
        compressionLevel: 9,
        progressive: true,
        palette: true,
        adaptiveFiltering: true,
      });
    }

    // Save processed image
    const outputInfo = await processedImage.toFile(filePath);

    return {
      filename,
      originalName: sanitize(originalName),
      mimeType: validation.mimeType,
      fileSize: outputInfo.size,
      width: outputInfo.width,
      height: outputInfo.height,
    };
  }

  /**
   * Delete image file
   */
  public deleteImage(filename: string): boolean {
    try {
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting image:', error);
      return false;
    }
  }

  /**
   * Get image file path
   */
  public getImagePath(filename: string): string {
    return path.join(this.uploadDir, filename);
  }

  /**
   * Check if image exists
   */
  public imageExists(filename: string): boolean {
    return fs.existsSync(this.getImagePath(filename));
  }
}
