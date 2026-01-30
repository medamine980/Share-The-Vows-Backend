# Production Deployment

## Server Specifications
- **RAM**: 12GB (6GB allocated to container)
- **CPU**: 6 cores (4 cores allocated, PM2 uses 4 instances)
- **Storage**: 190GB total (75GB limit for uploads)
- **OS**: Linux VPS

## Deployment Steps

### 1. Pull Latest Code
```bash
cd /path/to/Share-The-Vows-Backend
git pull origin main
```

### 2. Rebuild Container (No Cache)
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 3. Verify Deployment
```bash
# Check container status
docker ps | grep wedding-photos-api

# Check logs
docker-compose logs -f wedding-photos-api

# Check health
curl http://localhost:3333/health
```

## Performance Optimizations

### PM2 Clustering
- **Instances**: 4 (one per allocated core)
- **Mode**: Cluster mode for load balancing
- **Memory Limit**: 1.2GB per instance
- **Heap Size**: 1.125GB per instance
- **Auto-restart**: Yes

### Docker Resources
- **CPU Limit**: 4 cores
- **CPU Reservation**: 2 cores minimum
- **Memory Limit**: 6GB
- **Memory Reservation**: 3GB minimum
- **Shared Memory**: 256MB for Sharp processing

### SQLite Optimizations
- **Journal Mode**: WAL (Write-Ahead Logging)
- **Cache Size**: 128MB
- **Memory-Mapped I/O**: 30GB
- **Page Size**: 4096 bytes

### Image Processing
- **Compression Quality**: 82 (balance between quality/size)
- **Max Dimensions**: 4096x4096
- **Formats**: JPEG (mozjpeg), WebP, PNG
- **HEIC Handling**: Converted to JPEG by frontend (heic2any)

## Monitoring

### Health Check
```bash
curl https://wedding.pfedaba.ma/health
```

### Storage Usage
```bash
curl https://wedding.pfedaba.ma/api/stats
```

### Container Stats
```bash
docker stats wedding-photos-api
```

### PM2 Status (inside container)
```bash
docker exec -it wedding-photos-api pm2 list
docker exec -it wedding-photos-api pm2 monit
```

## Maintenance

### View Logs
```bash
# Real-time logs
docker-compose logs -f wedding-photos-api

# Last 100 lines
docker-compose logs --tail=100 wedding-photos-api
```

### Restart Service
```bash
# Graceful restart
docker-compose restart wedding-photos-api

# Force restart
docker-compose down && docker-compose up -d
```

### Backup Database
```bash
# Copy from container
docker cp wedding-photos-api:/app/data/wedding_photos.db ./backup-$(date +%Y%m%d).db

# Or from mounted volume
cp ./data/wedding_photos.db ./backup-$(date +%Y%m%d).db
```

### Clean Up Old Images (if needed)
```bash
# Remove unused Docker images
docker image prune -a
```

## Security Checklist
- ✅ CORS restricted to frontend domain
- ✅ Rate limiting (100 req/15min, 20 uploads/15min)
- ✅ File size limits (10MB per file)
- ✅ Storage quota (75GB)
- ✅ Input sanitization
- ✅ EXIF stripping (privacy)
- ✅ Magic byte validation
- ✅ Non-root container user
- ✅ HTTPS via nginx reverse proxy

## Expected Performance
- **Upload Speed**: ~2-3 images/second
- **Concurrent Uploads**: Up to 4 simultaneous (PM2 instances)
- **Memory Usage**: 3-4GB under normal load
- **CPU Usage**: 40-60% during peak uploads
- **Response Time**: <200ms for GET requests
- **Image Processing**: 1-2 seconds per 4096x4096 JPEG

## Troubleshooting

### High Memory Usage
```bash
# Check PM2 processes
docker exec -it wedding-photos-api pm2 list

# Restart if needed
docker-compose restart wedding-photos-api
```

### Slow Uploads
- Check CPU usage: `docker stats wedding-photos-api`
- Verify disk I/O isn't saturated
- Check network bandwidth

### Storage Full
- Check current usage: `curl https://wedding.pfedaba.ma/api/stats`
- Increase limit in docker-compose.yml (MAX_STORAGE_GB)
- Clean up old images if needed
