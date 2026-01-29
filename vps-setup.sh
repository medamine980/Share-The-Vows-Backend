#!/bin/bash

# VPS Setup Script
# Run this once before first docker-compose up

set -e

echo "🚀 Setting up Share The Vows Backend on VPS..."

# Create required directories
echo "📁 Creating directories..."
mkdir -p uploads
mkdir -p data

# Set proper ownership for container user (UID 1001, GID 1001)
echo "🔐 Setting ownership and permissions..."
chown -R 1001:1001 uploads
chown -R 1001:1001 data
chmod -R 755 uploads
chmod -R 755 data

echo "✅ Setup complete! Now run: docker-compose up -d --build"
