# API Endpoints

Base URL: `http://your-vps-ip:3333/api` or `https://api.yourwedding.com/api`

## 📤 Upload Photo
```
POST /api/upload

Content-Type: multipart/form-data

Body:
- image (required): Image file
- guestName (optional): String, max 100 chars
- caption (optional): String, max 500 chars

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

## 📸 Get Latest 20 Photos
```
GET /api/latest

Response:
{
  "status": "success",
  "data": {
    "photos": [
      {
        "id": 1,
        "guestName": "John Doe",
        "caption": "Beautiful moment!",
        "width": 1920,
        "height": 1080,
        "uploadedAt": "2026-01-29T12:00:00Z",
        "fileUrl": "/api/photos/1/file"
      }
    ]
  }
}
```

## 📋 Get All Photos (Paginated)
```
GET /api/photos?limit=50&offset=0

Response:
{
  "status": "success",
  "data": {
    "photos": [...],
    "pagination": {
      "total": 150,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

## 🖼️ Get Single Photo Info
```
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

## 🎨 Get Photo File (Image)
```
GET /api/photos/:id/file

Returns: Binary image with proper Content-Type and caching headers
Use this in <img> tags:
<img src="http://your-vps:3333/api/photos/1/file" />
```

## 📊 Get Storage Stats
```
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

## 🗑️ Delete Photo (Admin)
```
DELETE /api/photos/:id

Response:
{
  "status": "success",
  "message": "Photo deleted successfully"
}
```

## ❤️ Health Check
```
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
