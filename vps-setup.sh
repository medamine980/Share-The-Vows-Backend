#!/bin/bash

# VPS Setup Script
# Run this once before first docker-compose up

set -e

echo "🚀 Setting up Share The Vows Backend on VPS..."

# Create required directories
echo "📁 Creating directories..."
mkdir -p uploads
mkdir -p data

# Set proper permissions
echo "🔐 Setting permissions..."
chmod 755 uploads
chmod 755 data

echo "✅ Setup complete! Now run: docker-compose up -d --build"
