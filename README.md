# PropTech Ecosystem Platform

A modular, multi-sided marketplace connecting property buyers/renters with builders/developers through AI-powered discovery, 3D visualization, and intelligent lead management.

## Architecture

This is a monorepo using Turborepo with the following structure:

```
proptech-ecosystem/
├── packages/
│   └── api/              # Backend API (Node.js + TypeScript + Express)
├── apps/
│   ├── user-dashboard/   # User frontend (React + TypeScript) [To be added]
│   ├── builder-dashboard/# Builder frontend (React + TypeScript) [To be added]
│   └── admin-dashboard/  # Admin frontend (React + TypeScript) [To be added]
└── package.json          # Root package.json with workspaces
```

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 14 with pgvector extension
- Redis >= 6.0

## Quick Setup (Recommended)

We provide automated setup scripts that use Docker for PostgreSQL and Redis:

### Linux/macOS

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### Windows (PowerShell)

```powershell
.\scripts\setup.ps1
```

The setup script will:
1. Check prerequisites (Docker, Node.js)
2. Start PostgreSQL and Redis in Docker containers
3. Install npm dependencies
4. Run database migrations
5. Set up the development environment

After setup completes, start the development server:

```bash
npm run dev
```

## Manual Setup

If you prefer to set up services manually:

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up PostgreSQL with pgvector

**Option A: Using Docker (Recommended)**

```bash
docker-compose up -d postgres
```

**Option B: Manual Installation**

Install PostgreSQL and the pgvector extension:

```bash
# On Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib
sudo apt-get install postgresql-14-pgvector

# On macOS with Homebrew
brew install postgresql@14
brew install pgvector

# Start PostgreSQL
sudo service postgresql start  # Linux
brew services start postgresql@14  # macOS
```

Create the database:

```bash
psql -U postgres
CREATE DATABASE proptech;
CREATE USER proptech_user WITH PASSWORD 'proptech_password';
GRANT ALL PRIVILEGES ON DATABASE proptech TO proptech_user;
\q
```

### 3. Set Up Redis

**Option A: Using Docker (Recommended)**

```bash
docker-compose up -d redis
```

**Option B: Manual Installation**

```bash
# On Ubuntu/Debian
sudo apt-get install redis-server
sudo service redis-server start

# On macOS with Homebrew
brew install redis
brew services start redis
```

### 4. Configure Environment Variables

A `.env` file is already created with default values for local development. Update it if needed:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: Secure random string (change for production)
- API keys for OpenAI, World Labs, Twilio, AWS (add when ready to use those features)

### 5. Run Database Migrations

```bash
cd packages/api
npm run migrate
cd ../..
```

This will:
- Enable the pgvector extension
- Create all database tables
- Set up indexes
- Insert the default Apartment module

### 6. Start Development Server

```bash
npm run dev
```

The API will be available at http://localhost:3000

## API Endpoints

### Health Check
```
GET /health
```

Returns the health status of the API and its dependencies (database, Redis).

### API Info
```
GET /api
```

Returns basic API information.

## Database Schema

The database includes the following main tables:

- **users**: User accounts with role-based access (USER, BUILDER, ADMIN)
- **sessions**: JWT session management
- **partners**: Builder/developer profiles
- **property_modules**: Modular property type registry
- **properties**: Property listings with vector embeddings for semantic search
- **models_3d**: 3D model metadata
- **design_assets**: User-generated 3D customizations
- **toll_free_numbers**: Telephony routing configuration
- **call_records**: Call history and recordings
- **behavior_events**: User interaction tracking
- **leads**: Lead management with AI scoring
- **transactions**: Financial transactions
- **invoices**: Commission invoicing
- **saved_properties**: User saved properties
- **audit_logs**: System audit trail

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 14+ with pgvector
- **Cache**: Redis
- **Job Queue**: Bull (Redis-backed)
- **Authentication**: JWT with bcrypt

### AI & External Services
- **Vector Search**: OpenAI text-embedding-3-small
- **3D Generation**: World Labs Marble API
- **Telephony**: Twilio
- **Transcription**: AWS Transcribe
- **Storage**: AWS S3

### Frontend (To be implemented)
- **Framework**: React 18+
- **Language**: TypeScript
- **3D Rendering**: Three.js / React Three Fiber
- **State Management**: Redux or Zustand

## Development

### Running the Development Server

```bash
npm run dev
```

This starts the API server with hot-reload enabled.

### Running Tests

To run all tests:

```bash
npm test
```

To run tests in watch mode:

```bash
cd packages/api
npm run test:watch
```

To run tests with coverage:

```bash
npm test -- --coverage
```

### Linting

```bash
npm run lint
```

### Building for Production

```bash
npm run build
```

### Docker Commands

Start all services:
```bash
docker-compose up -d
```

Stop all services:
```bash
docker-compose down
```

View logs:
```bash
docker-compose logs -f
```

Restart services:
```bash
docker-compose restart
```

## Project Status

✅ **Task 1 Complete**: Project infrastructure and core database schema
- Monorepo structure with Turborepo
- PostgreSQL database with pgvector extension
- Core database tables and indexes
- Redis caching setup
- Bull job queues
- Environment configuration
- Express API server with health checks

🔄 **Next Tasks**:
- Task 2: Authentication and authorization system
- Task 3: Property Module Registry
- Task 4: Vector Search Engine
- And more...

## License

Proprietary - All rights reserved
