# PropTech Ecosystem Platform Setup Script for Windows

Write-Host "🚀 PropTech Ecosystem Platform Setup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is installed
try {
    $dockerVersion = docker --version
    Write-Host "✓ Docker is installed: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is available
try {
    $composeVersion = docker-compose --version
    Write-Host "✓ Docker Compose is installed: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not installed. Please install Docker Compose first." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    $nodeMajorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    
    if ($nodeMajorVersion -lt 18) {
        Write-Host "❌ Node.js version must be >= 18.0.0 (current: $nodeVersion)" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Node.js $nodeVersion is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js >= 18.0.0" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Start Docker services
Write-Host "📦 Starting PostgreSQL and Redis with Docker..." -ForegroundColor Yellow
docker-compose up -d

Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check if services are running
$services = docker-compose ps
if ($services -match "healthy") {
    Write-Host "✓ PostgreSQL and Redis are running" -ForegroundColor Green
} else {
    Write-Host "⚠️  Services may not be fully ready yet. Waiting a bit longer..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

Write-Host ""

# Install dependencies
Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Run database migrations
Write-Host "🗄️  Running database migrations..." -ForegroundColor Yellow
Set-Location packages/api
npm run migrate

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Database migration failed" -ForegroundColor Red
    Set-Location ../..
    exit 1
}

Set-Location ../..

Write-Host "✓ Database migrations completed" -ForegroundColor Green
Write-Host ""

Write-Host "✅ Setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the development server, run:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "The API will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop the Docker services, run:" -ForegroundColor Cyan
Write-Host "  docker-compose down" -ForegroundColor White
