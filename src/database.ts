import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface Photo {
  id: number;
  filename: string;
  originalName: string;
  guestName?: string;
  caption?: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  uploadedAt: string;
  ipAddress?: string;
}

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    // Production-optimized SQLite settings
    this.db.pragma('journal_mode = WAL'); // Better concurrency
    this.db.pragma('synchronous = NORMAL'); // Balance safety/performance
    this.db.pragma('cache_size = -128000'); // 128MB cache for production
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 30000000000'); // 30GB memory-mapped I/O
    this.db.pragma('page_size = 4096'); // Optimal for most systems
    this.db.pragma('wal_autocheckpoint = 1000'); // Checkpoint every 1000 pages
    
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Create photos table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        original_name TEXT NOT NULL,
        guest_name TEXT,
        caption TEXT,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        CHECK(file_size > 0),
        CHECK(width > 0),
        CHECK(height > 0)
      )
    `);

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_uploaded_at ON photos(uploaded_at DESC);
      CREATE INDEX IF NOT EXISTS idx_guest_name ON photos(guest_name);
      CREATE INDEX IF NOT EXISTS idx_filename ON photos(filename);
    `);

    // Create storage stats table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS storage_stats (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        total_files INTEGER DEFAULT 0,
        total_size_bytes INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Initialize storage stats if not exists
    this.db.exec(`
      INSERT OR IGNORE INTO storage_stats (id, total_files, total_size_bytes) 
      VALUES (1, 0, 0)
    `);
  }

  public insertPhoto(photo: Omit<Photo, 'id' | 'uploadedAt'>): Photo {
    const stmt = this.db.prepare(`
      INSERT INTO photos (filename, original_name, guest_name, caption, mime_type, file_size, width, height, ip_address)
      VALUES (@filename, @originalName, @guestName, @caption, @mimeType, @fileSize, @width, @height, @ipAddress)
    `);

    const info = stmt.run({
      filename: photo.filename,
      originalName: photo.originalName,
      guestName: photo.guestName || null,
      caption: photo.caption || null,
      mimeType: photo.mimeType,
      fileSize: photo.fileSize,
      width: photo.width,
      height: photo.height,
      ipAddress: photo.ipAddress || null,
    });

    // Update storage stats
    this.updateStorageStats(photo.fileSize, 1);

    return this.getPhotoById(info.lastInsertRowid as number)!;
  }

  public getPhotoById(id: number): Photo | undefined {
    const stmt = this.db.prepare(`
      SELECT 
        id,
        filename,
        original_name as originalName,
        guest_name as guestName,
        caption,
        mime_type as mimeType,
        file_size as fileSize,
        width,
        height,
        uploaded_at as uploadedAt,
        ip_address as ipAddress
      FROM photos 
      WHERE id = ?
    `);

    return stmt.get(id) as Photo | undefined;
  }

  public getAllPhotos(limit = 100, offset = 0): Photo[] {
    const stmt = this.db.prepare(`
      SELECT 
        id,
        filename,
        original_name as originalName,
        guest_name as guestName,
        caption,
        mime_type as mimeType,
        file_size as fileSize,
        width,
        height,
        uploaded_at as uploadedAt,
        ip_address as ipAddress
      FROM photos 
      ORDER BY uploaded_at DESC
      LIMIT ? OFFSET ?
    `);

    return stmt.all(limit, offset) as Photo[];
  }

  public getStorageStats(): { totalFiles: number; totalSizeBytes: number; totalSizeGB: number } {
    const stmt = this.db.prepare(`
      SELECT total_files as totalFiles, total_size_bytes as totalSizeBytes 
      FROM storage_stats 
      WHERE id = 1
    `);

    const stats = stmt.get() as { totalFiles: number; totalSizeBytes: number };
    return {
      ...stats,
      totalSizeGB: stats.totalSizeBytes / (1024 * 1024 * 1024),
    };
  }

  private updateStorageStats(sizeBytes: number, fileCount: number): void {
    const stmt = this.db.prepare(`
      UPDATE storage_stats 
      SET total_files = total_files + ?, 
          total_size_bytes = total_size_bytes + ?,
          last_updated = CURRENT_TIMESTAMP
      WHERE id = 1
    `);

    stmt.run(fileCount, sizeBytes);
  }

  public deletePhoto(id: number): boolean {
    const photo = this.getPhotoById(id);
    if (!photo) return false;

    const stmt = this.db.prepare('DELETE FROM photos WHERE id = ?');
    const info = stmt.run(id);

    if (info.changes > 0) {
      this.updateStorageStats(-photo.fileSize, -1);
      return true;
    }

    return false;
  }

  public close(): void {
    this.db.close();
  }

  public getPhotoCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM photos');
    const result = stmt.get() as { count: number };
    return result.count;
  }
}
