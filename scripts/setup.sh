#!/bin/bash

echo "🚀 PropTech Ecosystem Platform Setup"
echo "===================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✓ Docker and Docker Compose are installed"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js >= 18.0.0"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be >= 18.0.0 (current: $(node -v))"
    exit 1
fi

echo "✓ Node.js $(node -v) is installed"
echo ""

# Start Docker services
echo "📦 Starting PostgreSQL and Redis with Docker..."
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are healthy
if ! docker-compose ps | grep -q "healthy"; then
    echo "⚠️  Services may not be fully ready yet. Waiting a bit longer..."
    sleep 10
fi

echo "✓ PostgreSQL and Redis are running"
echo ""

# Install dependencies
echo "📥 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed"
echo ""

# Run database migrations
echo "🗄️  Running database migrations..."
cd packages/api
npm run migrate

if [ $? -ne 0 ]; then
    echo "❌ Database migration failed"
    exit 1
fi

cd ../..

echo "✓ Database migrations completed"
echo ""

echo "✅ Setup completed successfully!"
echo ""
echo "To start the development server, run:"
echo "  npm run dev"
echo ""
echo "The API will be available at: http://localhost:3000"
echo ""
echo "To stop the Docker services, run:"
echo "  docker-compose down"
