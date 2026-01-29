# Wedding Photo Upload Backend

A secure, high-performance backend API for wedding photo uploads with automatic compression, storage management, and Docker containerization.

## 🚀 Features

### Security
- **Helmet.js** - Security headers and XSS protection
- **CORS** - Configurable cross-origin resource sharing
- **Rate Limiting** - IP-based request throttling (100 requests per 15 min, 20 uploads per 15 min)
- **File Validation** - Deep file type inspection using magic bytes
- **Input Sanitization** - XSS prevention on text inputs
- **EXIF Stripping** - Removes sensitive metadata from photos
- **SQL Injection Protection** - Parameterized queries with better-sqlite3

### Performance
- **Image Compression** - Automatic optimization with Sharp (quality: 85%)
- **Auto-resize** - Limits images to 4096x4096 pixels
- **Progressive JPEG** - Faster loading for large images
- **Response Compression** - gzip/brotli for API responses
- **Connection Pooling** - SQLite WAL mode for better concurrency
- **Caching Headers** - Immutable images with long-term caching

### Storage Management
- **50 GB Threshold** - Automatic storage limit enforcement
- **Real-time Tracking** - Database-backed storage statistics
- **Decompression Bomb Prevention** - Pixel limit protection
- **Automatic Cleanup** - Orphaned file detection

### Infrastructure
- **Docker** - Multi-stage build for minimal image size
- **Docker Compose** - One-command deployment
- **Health Checks** - Container and application monitoring
- **Graceful Shutdown** - Proper signal handling
- **Persistent Volumes** - Data persistence across restarts
- **Resource Limits** - CPU and memory constraints

## 📋 API Endpoints

### Upload Photo
```http
POST /api/upload
Content-Type: multipart/form-data

Fields:
- image (required): Image file (JPEG, PNG, WebP, HEIC)
- guestName (optional): Guest's name (max 100 chars)
- caption (optional): Photo caption (max 500 chars)

Response:
{
  "status": "success",
  "message": "Photo uploaded successfully",
  "data": {
    "id": 1,
    "uploadedAt": "2026-01-29T12:00:00Z",
    "filename": "uuid-generated.jpg",
    "width": 1920,
    "height": 1080
  }
}
```

### Get All Photos
```http
GET /api/photos?limit=100&offset=0

Response:
{
  "status": "success",
  "data": {
    "photos": [...],
    "pagination": {
      "total": 150,
      "limit": 100,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### Get Single Photo
```http
GET /api/photos/:id

Response:
{
  "status": "success",
  "data": {
    "id": 1,
    "guestName": "John Doe",
    "caption": "Beautiful ceremony!",
    "width": 1920,
    "height": 1080,
    "fileSize": 245760,
    "uploadedAt": "2026-01-29T12:00:00Z",
    "fileUrl": "/api/photos/1/file"
  }
}
```

### Serve Photo File
```http
GET /api/photos/:id/file

Returns: Image binary with appropriate Content-Type and caching headers
```

### Get Storage Stats
```http
GET /api/stats

Response:
{
  "status": "success",
  "data": {
    "totalPhotos": 150,
    "totalSizeBytes": 1073741824,
    "totalSizeGB": 1.0,
    "maxStorageGB": 50,
    "percentageUsed": 2.0
  }
}
```

### Delete Photo (Admin)
```http
DELETE /api/photos/:id

Response:
{
  "status": "success",
  "message": "Photo deleted successfully"
}
```

### Health Check
```http
GET /health

Response:
{
  "status": "healthy",
  "timestamp": "2026-01-29T12:00:00Z",
  "uptime": 3600,
  "storage": {
    "usedGB": 1.0,
    "maxGB": 50
  }
}
```

## 🛠️ Installation & Setup

### Prerequisites
- Docker & Docker Compose
- (For local development: Node.js 20+)

### Quick Start with Docker (Recommended)

1. **Clone and navigate to the project:**
   ```bash
   cd c:\Dev\Share-The-Vows-Backend
   ```

2. **Create environment file:**
   ```bash
   copy .env.example .env
   ```

3. **Edit `.env` file with your configuration:**
   ```env
   CORS_ORIGIN=https://yourweddingsite.com
   MAX_STORAGE_GB=50
   COMPRESSION_QUALITY=85
   ```

4. **Build and start the container:**
   ```bash
   docker-compose up -d
   ```

5. **Check logs:**
   ```bash
   docker-compose logs -f
   ```

6. **Test the API:**
   ```bash
   curl http://localhost:3000/health
   ```

### Local Development (Without Docker)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file from example:**
   ```bash
   copy .env.example .env
   ```

3. **Run in development mode:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

## 🐳 Docker Commands

```bash
# Build and start
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f app

# Restart services
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build

# Remove volumes (WARNING: deletes all photos and database)
docker-compose down -v
```

## 📁 Project Structure

```
Share-The-Vows-Backend/
├── src/
│   ├── server.ts              # Entry point
│   ├── app.ts                 # Express app setup
│   ├── config.ts              # Configuration management
│   ├── database.ts            # SQLite database service
│   ├── imageService.ts        # Image processing & compression
│   ├── middleware/
│   │   ├── errorHandler.ts   # Error handling
│   │   └── storage.ts         # Storage limit middleware
│   └── routes/
│       └── photoRoutes.ts     # Photo API routes
├── dist/                      # Compiled TypeScript (generated)
├── uploads/                   # Photo storage (persistent volume)
├── data/                      # SQLite database (persistent volume)
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Container orchestration
├── tsconfig.json              # TypeScript configuration
├── package.json               # Dependencies
└── .env.example               # Environment template
```

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |
| `MAX_FILE_SIZE` | `10485760` | Max upload size (bytes, 10MB) |
| `MAX_STORAGE_GB` | `50` | Maximum storage limit (GB) |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `UPLOAD_DIR` | `/app/uploads` | Photo storage directory |
| `DB_PATH` | `/app/data/wedding_photos.db` | SQLite database path |
| `COMPRESSION_QUALITY` | `85` | JPEG quality (1-100) |
| `MAX_IMAGE_WIDTH` | `4096` | Max image width (px) |
| `MAX_IMAGE_HEIGHT` | `4096` | Max image height (px) |

## 🔐 Security Best Practices

1. **Change CORS_ORIGIN** to your actual frontend domain
2. **Add authentication** for DELETE endpoint (not included by default)
3. **Use HTTPS** in production (reverse proxy like nginx/Traefik)
4. **Regular backups** of database and uploads volumes
5. **Monitor logs** for suspicious activity
6. **Update dependencies** regularly for security patches

## 📊 Database Schema

```sql
CREATE TABLE photos (
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
  ip_address TEXT
);

CREATE TABLE storage_stats (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  total_files INTEGER DEFAULT 0,
  total_size_bytes INTEGER DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Production Deployment

### Recommended Setup
1. **Reverse Proxy**: nginx or Traefik for SSL/TLS
2. **Monitoring**: Prometheus + Grafana
3. **Logging**: ELK Stack or Loki
4. **Backups**: Automated volume backups
5. **CDN**: CloudFront/CloudFlare for image delivery

### Example nginx configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name api.yourweddingsite.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        client_max_body_size 11M;
    }
}
```

## 🧪 Testing

Upload a test image:
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "image=@photo.jpg" \
  -F "guestName=John Doe" \
  -F "caption=Amazing wedding!"
```

## 📝 License

MIT

## 🤝 Support

For issues or questions, check the logs:
```bash
docker-compose logs -f app
```

---

**Built with ❤️ for capturing wedding memories**
