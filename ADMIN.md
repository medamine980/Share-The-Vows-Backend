# Admin Guide - Database Management

## Quick Access - Admin Panel (Recommended)

### 1. Open Admin Panel
Visit: **https://wedding.pfedaba.ma/api/admin**

### 2. Enter Password
- Username: (anything, ignored)
- Password: Your `ADMIN_PASSWORD` from `.env`

### 3. Manage Photos
- **View all photos** with thumbnails in a grid
- **Click photos** to view full size
- **Delete inappropriate photos** with one click
- **View stats**: Total photos, storage used, etc.

---

## Alternative Access - SQLite Web Viewer

### 1. Create SSH Tunnel
```bash
ssh -L 8765:localhost:8765 root@37.60.254.169
```

### 2. Open Admin Panel
Open browser: **http://localhost:8765**

Keep the SSH connection open while using the admin panel.

---

## Common Tasks

### Delete Inappropriate Photo

**Using Admin Panel** (Recommended)
1. Go to https://wedding.pfedaba.ma/api/admin
2. Enter your admin password
3. Browse photos in the grid
4. Click "🗑️ Delete Photo" button on any inappropriate photo
5. Confirm deletion
6. Photo is removed from both database and filesystem

**Option 2: Via Admin Panel + Docker**
1. Open admin panel (http://localhost:8080)
2. Click "photos" table
3. Find the photo (by ID, guest name, or date)
4. **Copy the `filename` value** (e.g., `abc123-def456.jpg`)
5. Click the row's delete button (⚠️ This only removes database entry)
6. Delete the actual file:
   ```bash
   docker exec wedding-photos-api rm /app/uploads/abc123-def456.jpg
   ```

**Option 2: Using the API Delete Endpoint**
```bash
# First, find the photo ID from the admin panel or API
# Then delete it (requires authentication)
curl -X DELETE https://wedding.pfedaba.ma/api/photos/123 \
  -u "admin:your-admin-password"

# Response:
# {"status":"success","message":"Photo deleted successfully"}
```

**Option 3: Direct Database + Filesystem**
```bash
# On VPS, connect to SQLite
docker exec -it wedding-db-admin sqlite3 /data/wedding_photos.db

# Find photo
SELECT id, filename, guest_name, uploaded_at FROM photos ORDER BY uploaded_at DESC LIMIT 20;

# Delete from database
DELETE FROM photos WHERE id = 123;

# Exit SQLite
.exit

# Delete file
rm ./uploads/filename-from-above.jpg
```

### View Storage Stats
```bash
# Via API
curl https://wedding.pfedaba.ma/api/stats

# Or in admin panel SQL tab:
SELECT 
  COUNT(*) as total_photos,
  SUM(file_size) / 1024.0 / 1024.0 / 1024.0 as total_gb
FROM photos;
```

### Find Photos by Guest
```bash
# In admin panel SQL tab
SELECT id, guest_name, caption, filename, uploaded_at 
FROM photos 
WHERE guest_name LIKE '%John%'
ORDER BY uploaded_at DESC;
```

### Export Database Backup
```bash
# On VPS
cp ./data/wedding_photos.db ./backup-$(date +%Y%m%d-%H%M).db

# Download to local machine
scp root@37.60.254.169:/path/to/Share-The-Vows-Backend/backup-*.db ./
```

---

## Admin Panel Features

### Tables Tab
- View all database tables
- Browse photo records
- Edit/delete individual rows
- Export table data as CSV/JSON

### Query Tab
- Execute custom SQL queries
- Filter and search data
- Join tables for complex queries

### Structure Tab
- View table schemas
- See indexes and constraints
- Analyze database structure

---

## Security Notes

- ✅ Admin panel only accessible via SSH tunnel (not exposed to internet)
- ✅ Protected by your VPS SSH key
- ✅ No password needed (SSH authentication is the security layer)
- ⚠️ Database has write access - be careful with deletions
- ⚠️ Always backup before bulk operations

---

## Troubleshooting

### Can't Access Admin Panel
```bash
# Check if container is running
docker ps | grep wedding-db-admin

# Check logs
docker-compose logs db-admin

# Restart admin container
docker-compose restart db-admin
```

### Database Locked Error
The main API and admin panel share the same database. SQLite can handle multiple readers but only one writer at a time.

**Solution**: Just retry the operation - WAL mode handles this automatically.

### Photo Shows in Database but File Missing
```bash
# Find orphaned records
docker exec -it wedding-db-admin sqlite3 /data/wedding_photos.db \
  "SELECT id, filename FROM photos;" > /tmp/all_photos.txt

# Check which files actually exist
docker exec wedding-photos-api ls /app/uploads

# Delete orphaned database entries if needed
```

---

## Quick Reference

| Task | Command/URL |
|------|-------------|
| Access admin panel | http://localhost:8765 (via SSH tunnel) |
| View all photos | Click "photos" table |
| Delete photo | Use API: `DELETE /api/photos/:id` |
| Check stats | https://wedding.pfedaba.ma/api/stats |
| Backup database | `cp ./data/wedding_photos.db ./backup.db` |
| View logs | `docker-compose logs -f wedding-photos-api` |
