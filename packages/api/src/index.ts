import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { pool } from './db';
import { getRedisClient } from './cache/redis';
import authRoutes from './routes/auth.routes';
import moduleRegistryRoutes from './routes/module-registry.routes';
import propertyRoutes from './routes/property.routes';
import searchRoutes from './routes/search.routes';
import behaviorEventsRoutes from './routes/behavior-events.routes';
import leadsRoutes from './routes/leads.routes';
import transactionsRoutes from './routes/transactions.routes';

const app: Application = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Check database
    await pool.query('SELECT 1');
    
    // Check Redis
    const redis = await getRedisClient();
    await redis.ping();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API routes will be added here
app.get('/api', (req: Request, res: Response) => {
  res.json({
    name: 'PropTech Ecosystem API',
    version: '1.0.0',
    status: 'running',
  });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Module registry routes
app.use('/api/modules', moduleRegistryRoutes);

// Property routes
app.use('/api/properties', propertyRoutes);

// Search routes
app.use('/api/search', searchRoutes);

// Behavior events routes
app.use('/api/events', behaviorEventsRoutes);

// Leads routes
app.use('/api/leads', leadsRoutes);

// Transactions routes
app.use('/api/transactions', transactionsRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
      requestId: req.headers['x-request-id'] || 'unknown',
    },
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  const statusCode = (err as any).statusCode || 500;
  const message = config.nodeEnv === 'production' 
    ? 'An internal server error occurred'
    : err.message;

  res.status(statusCode).json({
    error: {
      code: (err as any).code || 'INTERNAL_ERROR',
      message,
      requestId: req.headers['x-request-id'] || 'unknown',
      ...(config.nodeEnv !== 'production' && { stack: err.stack }),
    },
  });
});

// Start server
const PORT = config.port;

async function startServer() {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('✓ Database connected');

    // Test Redis connection
    await getRedisClient();
    console.log('✓ Redis connected');

    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ Environment: ${config.nodeEnv}`);
      console.log(`✓ API URL: ${config.apiBaseUrl}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

export default app;
