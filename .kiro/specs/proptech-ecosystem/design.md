# Design Document: PropTech Ecosystem Platform

## Overview

The PropTech Ecosystem Platform is a service-oriented, modular architecture designed to connect property seekers with builders through AI-enhanced discovery, visualization, and lead management. The system consists of three primary subsystems serving distinct user roles (User, Builder, Admin), unified by a core engine that provides vector search, AI-driven 3D customization, and telephony-based lead intelligence.

The architecture prioritizes modularity to support future expansion into rental and land management domains while maintaining clean separation of concerns between property types. The platform leverages modern AI capabilities including semantic search via vector embeddings, generative 3D visualization through world models, and natural language processing for call transcript analysis.

### Design Principles

1. **Modularity**: Property types (Apartment, Rental, Land) are implemented as pluggable modules with standardized interfaces
2. **Role-Based Separation**: Each user role (User, Builder, Admin) has dedicated services and UI components
3. **AI-First**: Core features leverage AI for search, visualization, and lead scoring rather than rule-based approaches
4. **Scalability**: Stateless services with horizontal scaling capabilities and asynchronous processing for heavy workloads
5. **Privacy by Design**: Encryption, consent management, and data minimization built into core architecture

## Architecture

### High-Level System Architecture

The platform follows a microservices architecture with the following major components:

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
│                    (Authentication, Routing)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌────────▼────────┐   ┌──────▼──────┐
│  User Service  │   │ Builder Service │   │Admin Service│
│   (Frontend)   │   │   (Frontend)    │   │ (Frontend)  │
└───────┬────────┘   └────────┬────────┘   └──────┬──────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌────────▼────────┐   ┌──────▼──────────┐
│ Search Service │   │  Studio Service │   │ Telephony Service│
│ (Vector+Text)  │   │  (3D AI Gen)    │   │ (Call Routing)  │
└───────┬────────┘   └────────┬────────┘   └──────┬──────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌────────▼────────┐   ┌──────▼──────────┐
│ Lead Scoring   │   │Property Module  │   │ Commission      │
│    Engine      │   │   Registry      │   │    Ledger       │
└───────┬────────┘   └────────┬────────┘   └──────┬──────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Database Layer   │
                    │ (PostgreSQL + Vec) │
                    └────────────────────┘
```

### Service Responsibilities

**API Gateway**:
- JWT-based authentication and session management
- Request routing to appropriate backend services
- Rate limiting and DDoS protection
- Request/response logging

**Search Service**:
- Hybrid search combining PostgreSQL full-text search with vector similarity
- Property indexing and cache management
- Filter application and result ranking
- Integration with Property Module Registry for cross-module search

**Studio Service**:
- 3D model loading and rendering coordination
- Integration with AI world model APIs for text/image-to-3D generation
- Design asset storage and retrieval
- Caching of generated models

**Telephony Service**:
- Toll-free number provisioning and management
- Call routing via SIP/VoIP protocols
- Call recording with consent management
- Integration with transcription services

**Lead Scoring Engine**:
- Behavioral event ingestion (views, saves, calls, designs)
- Score calculation based on weighted rules
- Call transcript analysis using NLP
- Score decay processing for time-based relevance

**Property Module Registry**:
- Dynamic registration of property type modules
- Schema extension management
- Module-specific business logic routing
- Version management for module updates

**Commission Ledger**:
- Transaction recording for sales and design services
- Commission calculation based on tiered rules
- Invoice generation and payment tracking
- Financial reporting and analytics

## Components and Interfaces

### 1. Authentication and Authorization Component

**Purpose**: Manage user identity, sessions, and role-based access control

**Interfaces**:

```typescript
interface AuthService {
  register(email: string, password: string, role: UserRole): Promise<User>
  login(email: string, password: string): Promise<SessionToken>
  logout(token: SessionToken): Promise<void>
  verifyToken(token: SessionToken): Promise<User>
  enableMFA(userId: string, method: MFAMethod): Promise<MFASecret>
  verifyMFA(userId: string, code: string): Promise<boolean>
}

interface User {
  id: string
  email: string
  role: UserRole
  createdAt: Date
  mfaEnabled: boolean
}

enum UserRole {
  USER = "USER",
  BUILDER = "BUILDER",
  ADMIN = "ADMIN"
}

interface SessionToken {
  token: string
  expiresAt: Date
  userId: string
}
```

**Implementation Notes**:
- Use bcrypt for password hashing with salt rounds = 12
- JWT tokens with HS256 signing, 24-hour expiration
- Refresh tokens stored in database with 30-day expiration
- MFA using TOTP (Time-based One-Time Password) standard

### 2. Vector Search Component

**Purpose**: Provide semantic property search using vector embeddings

**Interfaces**:

```typescript
interface VectorSearchService {
  indexProperty(property: Property): Promise<void>
  searchSemantic(query: string, filters: SearchFilters): Promise<SearchResult[]>
  searchHybrid(query: string, filters: SearchFilters): Promise<SearchResult[]>
  updateEmbedding(propertyId: string): Promise<void>
  deleteFromIndex(propertyId: string): Promise<void>
}

interface SearchFilters {
  priceMin?: number
  priceMax?: number
  location?: string[]
  propertyType?: string[]
  moduleType?: ModuleType[]
}

interface SearchResult {
  property: Property
  similarityScore: number
  matchType: "semantic" | "keyword" | "hybrid"
}

interface Property {
  id: string
  title: string
  description: string
  price: number
  location: string
  moduleType: ModuleType
  builderId: string
  images: string[]
  metadata: Record<string, any>
  embedding?: number[]
}
```

**Implementation Notes**:
- Use OpenAI text-embedding-3-small model for generating embeddings (1536 dimensions)
- Store embeddings in PostgreSQL with pgvector extension
- Hybrid search: 0.6 weight to semantic, 0.4 weight to keyword
- Similarity threshold: 0.7 for semantic matches
- Cache search results for 5 minutes using Redis

### 3. AI Studio Component

**Purpose**: Generate and manage 3D property visualizations with AI customization

**3D Technology Stack**:
- **3D Model Format**: GLB (GL Transmission Format Binary) - industry standard for web 3D
- **3D Viewer Library**: Three.js (primary) with React Three Fiber for React integration
- **Alternative Viewer**: Babylon.js for advanced rendering features
- **AI Generation Service**: Luma AI Genie API for text-to-3D and image-to-3D conversion
- **Model Optimization**: Draco compression for efficient web delivery
- **Rendering**: WebGL 2.0 for browser-based 3D rendering

**Interfaces**:

```typescript
interface StudioService {
  load3DModel(propertyId: string): Promise<Model3D>
  customizeWithText(modelId: string, prompt: string): Promise<DesignAsset>
  customizeWithImage(modelId: string, imageUrl: string): Promise<DesignAsset>
  saveDesign(userId: string, propertyId: string, design: DesignAsset): Promise<string>
  getDesign(designId: string): Promise<DesignAsset>
  listUserDesigns(userId: string): Promise<DesignAsset[]>
}

interface Model3D {
  id: string
  propertyId: string
  meshUrl: string
  textureUrls: string[]
  metadata: ModelMetadata
}

interface DesignAsset {
  id: string
  userId: string
  propertyId: string
  baseModelId: string
  customizationPrompt: string
  customizationType: "text" | "image"
  generatedModelUrl: string
  status: DesignStatus
  builderFeedback?: string
  createdAt: Date
}

enum DesignStatus {
  PENDING = "PENDING",
  FEASIBLE = "FEASIBLE",
  REQUIRES_ADJUSTMENT = "REQUIRES_ADJUSTMENT"
}
```

**Implementation Notes**:
- Primary 3D generation: **Luma AI Genie** for text-to-3D and image-to-3D generation
  - Supports high-quality 3D mesh generation from text prompts
  - Provides image-conditioned 3D generation for style transfer
  - API-based integration with reasonable generation times (10-20 seconds)
- Fallback option: **Meshy AI** for additional capacity and redundancy
- Alternative for simpler use cases: **Spline AI** for real-time 3D scene editing
- Use job queue (Bull/Redis) for asynchronous 3D generation
- Store generated models in S3-compatible object storage (AWS S3 or Cloudflare R2)
- Model format: GLB (GL Transmission Format Binary) for web compatibility
- Implement timeout of 30 seconds for generation, fallback to base model on failure
- Cache base models in CDN (CloudFront or Cloudflare CDN) for fast loading
- Texture resolution: 2K for base models, 4K for premium customizations

### 4. Telephony Component

**Purpose**: Manage toll-free calling, routing, and recording

**Interfaces**:

```typescript
interface TelephonyService {
  provisionNumber(builderId: string): Promise<TollFreeNumber>
  routeCall(tollFreeNumber: string, userPhone: string): Promise<CallSession>
  recordCall(sessionId: string): Promise<void>
  endCall(sessionId: string): Promise<CallRecord>
  getCallHistory(userId: string): Promise<CallRecord[]>
  getTranscript(callId: string): Promise<string>
}

interface TollFreeNumber {
  number: string
  builderId: string
  builderPhone: string
  active: boolean
}

interface CallSession {
  id: string
  tollFreeNumber: string
  userPhone: string
  builderPhone: string
  startTime: Date
  status: CallStatus
}

enum CallStatus {
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  ENDED = "ENDED",
  FAILED = "FAILED"
}

interface CallRecord {
  id: string
  userId: string
  builderId: string
  propertyId: string
  duration: number
  recordingUrl?: string
  transcriptUrl?: string
  timestamp: Date
}
```

**Implementation Notes**:
- Use Twilio or similar VoIP provider for telephony infrastructure
- Play consent disclosure before recording starts
- Store recordings encrypted in S3 with 90-day auto-deletion
- Use speech-to-text service (e.g., AWS Transcribe, Google Speech-to-Text) for transcription
- Implement call failure retry logic with exponential backoff

### 5. Lead Scoring Component

**Purpose**: Calculate and maintain purchase intent scores based on user behavior

**Interfaces**:

```typescript
interface LeadScoringService {
  recordEvent(event: BehaviorEvent): Promise<void>
  calculateScore(userId: string, propertyId: string): Promise<number>
  analyzeCallTranscript(callId: string): Promise<number>
  getLeadScore(leadId: string): Promise<LeadScore>
  getBuilderLeads(builderId: string, sortBy: "score" | "date"): Promise<Lead[]>
  decayScores(): Promise<void>
}

interface BehaviorEvent {
  userId: string
  propertyId: string
  eventType: EventType
  timestamp: Date
  metadata?: Record<string, any>
}

enum EventType {
  VIEW = "VIEW",
  SAVE = "SAVE",
  DESIGN = "DESIGN",
  CALL = "CALL"
}

interface LeadScore {
  leadId: string
  userId: string
  propertyId: string
  builderId: string
  score: number
  lastActivity: Date
  events: BehaviorEvent[]
}

interface Lead {
  id: string
  user: User
  property: Property
  score: number
  status: LeadStatus
  contactMethod: string
  recentActivity: string
  createdAt: Date
}

enum LeadStatus {
  NEW = "NEW",
  HOT = "HOT",
  CONTACTED = "CONTACTED",
  CONVERTED = "CONVERTED",
  LOST = "LOST"
}
```

**Implementation Notes**:
- Base scoring rules: VIEW=20, SAVE=30, DESIGN=40, CALL=50
- Call transcript analysis: Extract purchase intent keywords (buy, purchase, interested, budget, timeline)
- Add 0-20 points based on keyword frequency and sentiment
- Decay: Reduce score by 10% per week of inactivity
- Run decay job daily via cron
- Mark leads as "HOT" when score >= 80

### 6. Property Module Registry Component

**Purpose**: Enable pluggable property type modules with dynamic schema extension

**Interfaces**:

```typescript
interface ModuleRegistry {
  registerModule(module: PropertyModule): Promise<void>
  getModule(moduleType: ModuleType): Promise<PropertyModule>
  listActiveModules(): Promise<PropertyModule[]>
  enableModule(moduleType: ModuleType): Promise<void>
  disableModule(moduleType: ModuleType): Promise<void>
}

interface PropertyModule {
  type: ModuleType
  version: string
  schema: ModuleSchema
  validator: PropertyValidator
  uiComponents: UIComponentMap
  active: boolean
}

enum ModuleType {
  APARTMENT = "APARTMENT",
  RENTAL = "RENTAL",
  LAND = "LAND"
}

interface ModuleSchema {
  fields: SchemaField[]
  indexes: string[]
}

interface SchemaField {
  name: string
  type: "string" | "number" | "boolean" | "date" | "json"
  required: boolean
  validation?: ValidationRule
}

interface PropertyValidator {
  validate(property: Property): ValidationResult
}

interface ValidationResult {
  valid: boolean
  errors: string[]
}

interface UIComponentMap {
  listView: string
  detailView: string
  formView: string
}
```

**Implementation Notes**:
- Store module configurations in database
- Use JSONB columns in PostgreSQL for module-specific fields
- Dynamically load UI components based on module type
- Validate properties against module schema before persistence
- Support schema migrations when module versions update

### 7. Commission Ledger Component

**Purpose**: Track financial transactions and calculate commissions

**Interfaces**:

```typescript
interface CommissionLedger {
  recordSale(sale: SaleTransaction): Promise<string>
  recordDesignPurchase(purchase: DesignPurchase): Promise<string>
  calculateCommission(transactionId: string): Promise<Commission>
  generateInvoice(builderId: string, month: number, year: number): Promise<Invoice>
  getFinancialSummary(startDate: Date, endDate: Date): Promise<FinancialSummary>
}

interface SaleTransaction {
  leadId: string
  propertyId: string
  builderId: string
  salePrice: number
  currency: string
  closedAt: Date
}

interface DesignPurchase {
  designId: string
  userId: string
  builderId: string
  amount: number
  currency: string
  purchasedAt: Date
}

interface Commission {
  transactionId: string
  transactionType: "sale" | "design"
  grossAmount: number
  commissionRate: number
  platformCommission: number
  builderPayout: number
  currency: string
}

interface Invoice {
  id: string
  builderId: string
  month: number
  year: number
  transactions: Commission[]
  totalCommission: number
  status: InvoiceStatus
  generatedAt: Date
}

enum InvoiceStatus {
  DRAFT = "DRAFT",
  ISSUED = "ISSUED",
  PAID = "PAID"
}

interface FinancialSummary {
  totalRevenue: number
  platformCommission: number
  builderPayouts: number
  pendingCommissions: number
  transactionCount: number
}
```

**Implementation Notes**:
- Commission rates: 2% (< $500K), 1.5% ($500K-$1M), 1% (> $1M)
- Design service: $50 per design, 70% to builder, 30% to platform
- Waive commission for first 3 sales from new partners
- Generate invoices on 1st of each month via scheduled job
- Support multi-currency with exchange rate tracking

## Data Models

### Core Database Schema

```sql
-- Users and Authentication
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('USER', 'BUILDER', 'ADMIN')),
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  refresh_token VARCHAR(500) UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Partners (Builders)
CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  business_license VARCHAR(255),
  tax_id VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED')),
  onboarded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Property Module Registry
CREATE TABLE property_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) UNIQUE NOT NULL,
  version VARCHAR(20) NOT NULL,
  schema JSONB NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Properties (Modular)
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  module_type VARCHAR(50) REFERENCES property_modules(type),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  location VARCHAR(255) NOT NULL,
  images TEXT[],
  module_data JSONB,
  embedding VECTOR(1536),
  status VARCHAR(20) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'SOLD', 'UNAVAILABLE')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_properties_embedding ON properties USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_properties_location ON properties(location);
CREATE INDEX idx_properties_price ON properties(price);
CREATE INDEX idx_properties_module_type ON properties(module_type);

-- 3D Models and Design Assets
CREATE TABLE models_3d (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  mesh_url VARCHAR(500) NOT NULL,
  texture_urls TEXT[],
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE design_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  base_model_id UUID REFERENCES models_3d(id),
  customization_prompt TEXT NOT NULL,
  customization_type VARCHAR(20) CHECK (customization_type IN ('text', 'image')),
  generated_model_url VARCHAR(500),
  status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'FEASIBLE', 'REQUIRES_ADJUSTMENT')),
  builder_feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP
);

CREATE INDEX idx_design_assets_user ON design_assets(user_id);
CREATE INDEX idx_design_assets_property ON design_assets(property_id);
CREATE INDEX idx_design_assets_status ON design_assets(status);

-- Telephony
CREATE TABLE toll_free_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number VARCHAR(20) UNIQUE NOT NULL,
  builder_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  builder_phone VARCHAR(50) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE call_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  builder_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  toll_free_number VARCHAR(20),
  duration INTEGER,
  recording_url VARCHAR(500),
  transcript_url VARCHAR(500),
  status VARCHAR(20) CHECK (status IN ('CONNECTING', 'ACTIVE', 'ENDED', 'FAILED')),
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

CREATE INDEX idx_call_records_user ON call_records(user_id);
CREATE INDEX idx_call_records_builder ON call_records(builder_id);

-- Lead Scoring
CREATE TABLE behavior_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('VIEW', 'SAVE', 'DESIGN', 'CALL')),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_behavior_events_user_property ON behavior_events(user_id, property_id);
CREATE INDEX idx_behavior_events_created ON behavior_events(created_at);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  builder_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'NEW' CHECK (status IN ('NEW', 'HOT', 'CONTACTED', 'CONVERTED', 'LOST')),
  last_activity TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_leads_builder_score ON leads(builder_id, score DESC);
CREATE INDEX idx_leads_status ON leads(status);

-- Financial Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  design_id UUID REFERENCES design_assets(id),
  builder_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) CHECK (transaction_type IN ('sale', 'design')),
  gross_amount DECIMAL(15, 2) NOT NULL,
  commission_rate DECIMAL(5, 4) NOT NULL,
  platform_commission DECIMAL(15, 2) NOT NULL,
  builder_payout DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  total_commission DECIMAL(15, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID')),
  generated_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP
);

CREATE INDEX idx_invoices_builder ON invoices(builder_id);
CREATE INDEX idx_invoices_month_year ON invoices(month, year);

-- User Saved Properties
CREATE TABLE saved_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  changes JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

### Module-Specific Schemas

**Apartment Module**:
```json
{
  "type": "APARTMENT",
  "fields": [
    {"name": "bedrooms", "type": "number", "required": true},
    {"name": "bathrooms", "type": "number", "required": true},
    {"name": "sqft", "type": "number", "required": true},
    {"name": "floor", "type": "number", "required": false},
    {"name": "building_name", "type": "string", "required": false},
    {"name": "amenities", "type": "json", "required": false},
    {"name": "parking_spaces", "type": "number", "required": false}
  ]
}
```

**Rental Module (Future)**:
```json
{
  "type": "RENTAL",
  "fields": [
    {"name": "bedrooms", "type": "number", "required": true},
    {"name": "bathrooms", "type": "number", "required": true},
    {"name": "sqft", "type": "number", "required": true},
    {"name": "monthly_rent", "type": "number", "required": true},
    {"name": "lease_term_months", "type": "number", "required": true},
    {"name": "deposit_amount", "type": "number", "required": true},
    {"name": "pet_friendly", "type": "boolean", "required": false},
    {"name": "available_from", "type": "date", "required": true}
  ]
}
```

**Land Module (Future)**:
```json
{
  "type": "LAND",
  "fields": [
    {"name": "acres", "type": "number", "required": true},
    {"name": "zoning", "type": "string", "required": true},
    {"name": "utilities_available", "type": "json", "required": false},
    {"name": "road_access", "type": "boolean", "required": true},
    {"name": "topography", "type": "string", "required": false},
    {"name": "soil_type", "type": "string", "required": false}
  ]
}
```

## AI Pipeline Flows

### Flow 1: Text-to-3D Customization Pipeline

```
User Input (Text Prompt)
         │
         ▼
┌────────────────────┐
│ Prompt Validation  │
│ - Length check     │
│ - Content filter   │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Load Base Model    │
│ - Fetch from cache │
│ - Or load from S3  │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Enqueue Job        │
│ - Add to Redis     │
│ - Return job ID    │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ AI Generation      │
│ - Call world model │
│ - Apply prompt     │
│ - Generate mesh    │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Post-Processing    │
│ - Optimize mesh    │
│ - Generate preview │
│ - Upload to S3     │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Store Design Asset │
│ - Save to DB       │
│ - Notify user      │
│ - Trigger lead evt │
└────────────────────┘
```

**Implementation Details**:
- Prompt validation: Max 500 characters, filter profanity/inappropriate content using content moderation API
- Base model cache: Redis with 1-hour TTL
- Job queue: Bull with Redis backend, 5 concurrent workers
- AI generation: **Luma AI Genie API** for text-to-3D and image-to-3D
  - Text-to-3D: POST to `/generate` endpoint with prompt and style parameters
  - Image-to-3D: POST with reference image URL for style conditioning
  - Poll generation status endpoint until completion
  - Download GLB file from provided URL
- AI generation timeout: 30 seconds, fallback to base model
- Mesh optimization: Reduce polygon count to < 100K triangles using mesh decimation
- Storage: AWS S3 or Cloudflare R2 with CloudFront/Cloudflare CDN for delivery
- Model viewer: Three.js or Babylon.js for web-based 3D rendering
- Mobile support: Use compressed GLB format for mobile devices

### Flow 2: Call-to-Lead-Score Pipeline

```
User Initiates Call
         │
         ▼
┌────────────────────┐
│ Play Consent Msg   │
│ - Recording notice │
│ - Wait for confirm │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Route Call         │
│ - Lookup builder   │
│ - Connect via SIP  │
│ - Start recording  │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Active Call        │
│ - Monitor duration │
│ - Stream audio     │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Call Ends          │
│ - Stop recording   │
│ - Upload audio     │
│ - Log metadata     │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Transcription      │
│ - Speech-to-text   │
│ - Generate text    │
│ - Store transcript │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ NLP Analysis       │
│ - Extract keywords │
│ - Sentiment score  │
│ - Intent detection │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Update Lead Score  │
│ - Add base points  │
│ - Add NLP bonus    │
│ - Save to DB       │
│ - Notify builder   │
└────────────────────┘
```

**Implementation Details**:
- Consent message: Pre-recorded audio, 5 seconds
- Call routing: Twilio Programmable Voice or similar
- Recording: WAV format, 16kHz, mono
- Transcription: AWS Transcribe or Google Speech-to-Text
- NLP keywords: ["buy", "purchase", "interested", "budget", "timeline", "financing", "mortgage"]
- Sentiment: Positive sentiment adds 5 points, negative subtracts 5
- Intent detection: High intent (explicit purchase language) adds 15 points
- Base call score: 50 points
- Total possible from call: 50 (base) + 20 (NLP) = 70 points


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property Reflection

After analyzing all acceptance criteria, several opportunities for consolidation were identified:
- Multiple scoring rules (16.1-16.4) can be combined into a single comprehensive scoring property
- Commission calculation rules (17.1, 17.3) can be unified into one tiered calculation property
- Dashboard navigation requirements (19.1-19.3) can be consolidated into role-based navigation property
- Error logging requirements across multiple criteria share common structure

### Search and Discovery Properties

**Property 1: Keyword Search Correctness**
*For any* keyword search query and property database, all returned properties should contain at least one of the search keywords in their title, description, or location fields.
**Validates: Requirements 1.1**

**Property 2: Vector Search Threshold Enforcement**
*For any* semantic search query, all returned properties should have similarity scores >= 0.7 when compared to the query embedding.
**Validates: Requirements 1.2**

**Property 3: Search Result Completeness**
*For any* search result set, every property card in the rendered output should contain images, price, location, and similarity score fields.
**Validates: Requirements 1.3**

**Property 4: Filter Application Correctness**
*For any* combination of active filters (price range, location, property type) and property database, all returned results should satisfy ALL active filter conditions.
**Validates: Requirements 1.4**

**Property 5: Module Integration in Search**
*For any* active property module, search results should include properties of that module type when relevant to the query.
**Validates: Requirements 1.5**

**Property 6: Pagination Consistency**
*For any* search result set, paginating through all pages with 20 items per page should yield the complete result set with no duplicates or omissions.
**Validates: Requirements 1.6**

### 3D Studio and Design Properties

**Property 7: Design Asset Persistence**
*For any* saved design asset, retrieving it from storage should return the same user ID, property ID, customization prompt, and model URL that were originally saved.
**Validates: Requirements 2.4**

**Property 8: Design Status Transitions**
*For any* design asset, valid status transitions should be: PENDING → FEASIBLE or PENDING → REQUIRES_ADJUSTMENT, and no other transitions should be allowed.
**Validates: Requirements 6.3, 6.4**

**Property 9: Design Review Completeness**
*For any* design asset displayed to a builder, the rendered view should include the 3D visualization, user prompts, and associated property details.
**Validates: Requirements 6.2**

**Property 10: Design Filter Correctness**
*For any* design status filter (Pending, Feasible, Requires Adjustment), the filtered results should contain only designs with that exact status.
**Validates: Requirements 6.6**

### Telephony and Call Management Properties

**Property 11: Call Recording Consent Enforcement**
*For any* call session, recording should only be initiated if the user has provided explicit consent during registration.
**Validates: Requirements 3.2, 18.2**

**Property 12: Call Logging Completeness**
*For any* completed call, the call record should contain duration, timestamp, associated property ID, and user ID.
**Validates: Requirements 3.3**

**Property 13: Call History Time Window**
*For any* user's call history query, only calls from the past 12 months should be returned.
**Validates: Requirements 3.6**

**Property 14: Call Recording Access Control**
*For any* call recording, access should be granted only to authorized admins and the associated builder, and denied to all other users.
**Validates: Requirements 18.3**

**Property 15: Call Recording Auto-Deletion**
*For any* call recording older than 90 days (unless flagged for dispute), the recording should be automatically deleted from storage.
**Validates: Requirements 18.4**

**Property 16: Call Recording Access Audit**
*For any* access to a call recording, an audit log entry should be created with accessor user ID, recording ID, and timestamp.
**Validates: Requirements 18.6**

### Inventory and Property Management Properties

**Property 17: Inventory Organization by Module**
*For any* builder's inventory, properties should be grouped by module type with all properties of the same module type appearing together.
**Validates: Requirements 4.1**

**Property 18: Property Validation on Creation**
*For any* property creation attempt with missing required fields, the validation should fail and return specific error messages for each missing field.
**Validates: Requirements 4.2**

**Property 19: Property Status Filtering**
*For any* public search query, properties with status "SOLD" or "UNAVAILABLE" should not appear in the results.
**Validates: Requirements 4.4**

**Property 20: Module-Specific Field Display**
*For any* active property module, the inventory interface should display all fields defined in that module's schema.
**Validates: Requirements 4.5**

**Property 21: Bulk Upload Validation**
*For any* CSV bulk upload, each row with validation errors should be reported with the row number and specific error messages.
**Validates: Requirements 4.6**

### Lead Scoring Properties

**Property 22: Behavioral Event Scoring**
*For any* sequence of user behavior events (VIEW, SAVE, DESIGN, CALL), the cumulative lead score should equal the sum of base points: VIEW=20, SAVE=30, DESIGN=40, CALL=50.
**Validates: Requirements 16.1, 16.2, 16.3, 16.4, 5.1, 5.3**

**Property 23: Call Transcript Keyword Scoring**
*For any* call transcript containing purchase intent keywords ["buy", "purchase", "interested", "budget", "timeline"], the additional score should be between 0 and 20 points based on keyword frequency.
**Validates: Requirements 16.5, 5.2**

**Property 24: Score Decay Over Time**
*For any* lead with no activity for N weeks, the score should be reduced by (10% × N) from its original value.
**Validates: Requirements 16.6**

**Property 25: Lead Sorting by Score**
*For any* builder's lead inbox, leads should be ordered by Purchase_Intent_Score in descending order (highest score first).
**Validates: Requirements 5.4**

**Property 26: Hot Lead Classification**
*For any* lead with Purchase_Intent_Score >= 80, the lead status should be marked as "HOT".
**Validates: Requirements 5.6**

**Property 27: Lead Card Completeness**
*For any* lead card displayed to a builder, it should contain user contact method, property interest, score, and recent activity information.
**Validates: Requirements 5.5**

### Analytics and Reporting Properties

**Property 28: Conversion Rate Calculation**
*For any* set of leads, the conversion rate should equal (number of converted leads / total number of leads) × 100.
**Validates: Requirements 7.3**

**Property 29: Lead Source Attribution**
*For any* lead, it should be attributed to exactly one source: search, 3D studio, or telephony, based on the first interaction type.
**Validates: Requirements 7.4**

**Property 30: Time-Series Data Aggregation**
*For any* time period (30, 90, or 365 days), the aggregated lead volume should equal the sum of leads created within that period.
**Validates: Requirements 7.5**

**Property 31: Analytics Export Completeness**
*For any* analytics export (CSV or PDF), the exported data should contain all metrics displayed in the analytics dashboard for the selected time period.
**Validates: Requirements 7.6**

**Property 32: Design Review Response Time Calculation**
*For any* set of reviewed designs, the average response time should equal the sum of (reviewed_at - created_at) divided by the number of designs.
**Validates: Requirements 6.5**

### Partner Management Properties

**Property 33: Partner Application Validation**
*For any* partner application missing required fields (business_name, business_license, tax_id, phone), the validation should fail and list all missing fields.
**Validates: Requirements 8.1**

**Property 34: Partner Approval Workflow**
*For any* approved partner application, the partner status should transition from PENDING to APPROVED, and the user role should be granted BUILDER access.
**Validates: Requirements 8.3**

**Property 35: Partner Rejection Recording**
*For any* rejected partner application, the rejection reason should be stored in the database and a notification should be sent to the applicant.
**Validates: Requirements 8.4**

**Property 36: Partner Status Audit Trail**
*For any* partner status change (suspend, reactivate), an audit log entry should be created with admin user ID, timestamp, old status, and new status.
**Validates: Requirements 8.6**

### Telephony Management Properties

**Property 37: Toll-Free Number Routing**
*For any* toll-free number assignment, incoming calls to that number should be routed to the mapped builder phone line.
**Validates: Requirements 9.2**

**Property 38: Telephony Configuration Audit**
*For any* telephony configuration change, an audit log entry should be created with admin user ID, timestamp, and change details.
**Validates: Requirements 9.5**

**Property 39: Call Failure Rate Alerting**
*For any* builder with call failure rate > 5% over a measurement period, an alert should be sent to admins.
**Validates: Requirements 9.6**

### Commission and Finance Properties

**Property 40: Tiered Commission Calculation**
*For any* property sale, the commission rate should be: 2% if price < $500K, 1.5% if $500K <= price < $1M, 1% if price >= $1M.
**Validates: Requirements 17.3, 10.1**

**Property 41: Design Service Fee Split**
*For any* design service purchase, the $50 fee should be split with $35 (70%) to the builder and $15 (30%) to the platform.
**Validates: Requirements 17.2, 10.2**

**Property 42: New Partner Commission Waiver**
*For any* new partner's first 3 sales, the platform commission should be $0 (waived).
**Validates: Requirements 17.4**

**Property 43: Commission Currency Consistency**
*For any* transaction, the commission should be calculated and recorded in the same currency as the property listing.
**Validates: Requirements 17.5**

**Property 44: Monthly Invoice Generation**
*For any* partner with transactions in a given month, an invoice should be automatically generated on the 1st of the following month containing all that month's transactions.
**Validates: Requirements 17.6, 10.6**

**Property 45: Financial Summary Accuracy**
*For any* time period, the financial summary's total revenue should equal the sum of all transaction gross amounts in that period.
**Validates: Requirements 10.3**

**Property 46: Commission Report Completeness**
*For any* commission report, each transaction entry should include transaction ID, amount, commission rate, platform commission, builder payout, and date.
**Validates: Requirements 10.4**

### Module Registry Properties

**Property 47: Module Schema Extension**
*For any* newly registered property module, the database should support storing and retrieving all fields defined in the module's schema.
**Validates: Requirements 12.1**

**Property 48: Module-Based Operation Routing**
*For any* property operation (create, update, delete), the operation should be routed to the handler for that property's module type.
**Validates: Requirements 12.3**

**Property 49: Cross-Module Search Aggregation**
*For any* search query, results should include properties from all active modules, merged and ranked together.
**Validates: Requirements 12.4**

**Property 50: Module Registry Integrity**
*For any* property module in the registry, it should have a unique type identifier, version number, schema definition, and active status.
**Validates: Requirements 12.5**

### Authentication and Authorization Properties

**Property 51: Password Validation Rules**
*For any* registration attempt, the password should be rejected if it doesn't meet all criteria: minimum 8 characters, at least 1 uppercase letter, at least 1 number.
**Validates: Requirements 13.1**

**Property 52: Email Format Validation**
*For any* registration attempt, the email should be rejected if it doesn't match the standard email format pattern (user@domain.tld).
**Validates: Requirements 13.1**

**Property 53: Session Token Expiration**
*For any* session token, it should be considered invalid and rejected if the current time exceeds the token's expiration timestamp (24 hours from issuance).
**Validates: Requirements 13.2, 13.4**

**Property 54: Role-Based Access Control**
*For any* request to a protected endpoint, access should be denied if the user's role doesn't match the required role for that endpoint.
**Validates: Requirements 13.3**

**Property 55: MFA Enforcement for Privileged Roles**
*For any* user with role BUILDER or ADMIN, login should require MFA verification after password authentication.
**Validates: Requirements 13.5**

**Property 56: Authentication Event Logging**
*For any* authentication event (login success, login failure, logout), an audit log entry should be created with user ID, event type, timestamp, and IP address.
**Validates: Requirements 13.6**

### Data Privacy and Compliance Properties

**Property 57: Registration Consent Requirement**
*For any* user registration, the registration should fail if explicit consent for call recording and data processing is not provided.
**Validates: Requirements 14.1**

**Property 58: PII Encryption at Rest**
*For any* personally identifiable information stored in the database, the data should be encrypted using AES-256 encryption.
**Validates: Requirements 14.2**

**Property 59: Data Deletion Completeness**
*For any* user data deletion request, all personal data (name, email, phone, addresses) should be removed while anonymized analytics data (aggregated counts, scores without user IDs) should be retained.
**Validates: Requirements 14.4**

**Property 60: Data Export Format**
*For any* user data export request, the exported file should be in valid JSON format and contain all user data (profile, properties, designs, calls).
**Validates: Requirements 14.5**

**Property 61: Data Access Audit Logging**
*For any* access to user personal data, an audit log entry should be created with accessor user ID, data type accessed, user ID whose data was accessed, and timestamp.
**Validates: Requirements 14.6**

### Performance and Scalability Properties

**Property 62: Search Result Caching**
*For any* search query, if the same query is executed within 5 minutes, the cached result should be returned instead of re-executing the search.
**Validates: Requirements 15.2**

**Property 63: Rate Limiting Enforcement**
*For any* user making more than 100 requests in a 1-minute window, subsequent requests should be rejected with a 429 (Too Many Requests) status code.
**Validates: Requirements 15.4**

**Property 64: Asynchronous AI Task Processing**
*For any* AI generation request (3D customization), the request should return immediately with a job ID, and the generation should be processed asynchronously without blocking the API response.
**Validates: Requirements 15.5**

### Error Handling Properties

**Property 65: API Retry Logic**
*For any* failed API request, the system should retry up to 3 times with exponential backoff (1s, 2s, 4s) before returning an error to the user.
**Validates: Requirements 20.1**

**Property 66: Vector Search Fallback**
*For any* search request when the Vector_Search_Engine is unavailable, the system should fall back to keyword-only search and include a notification in the response.
**Validates: Requirements 20.2**

**Property 67: AI Studio Error Recovery**
*For any* 3D generation failure, the system should preserve and display the previous valid model state and return an error message without losing user progress.
**Validates: Requirements 20.3**

**Property 68: Telephony Fallback Information**
*For any* call connection failure, the system should provide the builder's direct contact information as a fallback option.
**Validates: Requirements 20.4**

**Property 69: Error Logging with Severity**
*For any* error logged by the system, it should include a severity level (INFO, WARNING, ERROR, CRITICAL), timestamp, error message, and context information.
**Validates: Requirements 20.5**

**Property 70: Error Message Sanitization**
*For any* error message displayed to users, it should not contain technical implementation details such as stack traces, database queries, or internal service names.
**Validates: Requirements 20.6**

### User Dashboard Properties

**Property 71: User Saved Properties Persistence**
*For any* property saved by a user, it should appear in the user's saved properties list with the timestamp of when it was saved.
**Validates: Requirements 3.5**

**Property 72: Dashboard Data Aggregation**
*For any* user dashboard, it should display data from all three sources: saved properties, custom designs, and call history.
**Validates: Requirements 3.4**

**Property 73: Role-Based Navigation**
*For any* user login, the dashboard navigation should display only the menu items appropriate for that user's role: Users see (Search, AI Studio, Saved Properties, Call History), Builders see (Inventory, Lead Inbox, Design Review, Analytics), Admins see (Partners, Telephony, Finance, AI Monitoring).
**Validates: Requirements 19.1, 19.2, 19.3, 19.4**

**Property 74: Breadcrumb Path Correctness**
*For any* nested page, the breadcrumb navigation should show the complete path from the dashboard to the current page in hierarchical order.
**Validates: Requirements 19.6**

### AI System Monitoring Properties

**Property 75: Vector Search Metrics Aggregation**
*For any* monitoring dashboard query, the displayed metrics (query volume, average latency, error rate) should accurately reflect the aggregated data from the Vector_Search_Engine logs.
**Validates: Requirements 11.1**

**Property 76: AI Studio Success Rate Calculation**
*For any* time period, the AI Studio success rate should equal (successful generations / total generation attempts) × 100.
**Validates: Requirements 11.2**

**Property 77: Consecutive Latency Threshold Alerting**
*For any* sequence of 5 consecutive Vector_Search_Engine queries with latency > 3 seconds, an alert should be sent to admins.
**Validates: Requirements 11.3**

**Property 78: Time-Windowed Failure Rate Alerting**
*For any* 1-hour period where AI_Studio failure rate exceeds 10%, an alert should be sent to admins.
**Validates: Requirements 11.4**

**Property 79: AI Error Logging Completeness**
*For any* AI system error (Vector_Search_Engine or AI_Studio), the log entry should contain timestamp, input parameters, error message, and service name.
**Validates: Requirements 11.5**

**Property 80: Trending Analysis Correctness**
*For any* trending search terms or customization prompts, the items should be ranked by frequency of occurrence in descending order.
**Validates: Requirements 11.6**

## Error Handling

### Error Categories and Responses

**Validation Errors (400 Bad Request)**:
- Invalid email format during registration
- Weak password not meeting complexity requirements
- Missing required fields in property creation
- Invalid filter parameters in search requests
- Malformed JSON in API requests

**Authentication Errors (401 Unauthorized)**:
- Invalid credentials during login
- Expired session token
- Missing authentication token
- Invalid MFA code

**Authorization Errors (403 Forbidden)**:
- User attempting to access Builder endpoints
- Builder attempting to access Admin endpoints
- Unauthorized access to call recordings
- Attempt to modify another user's data

**Resource Not Found (404 Not Found)**:
- Property ID doesn't exist
- Design asset not found
- User profile not found
- Call record not found

**Rate Limiting (429 Too Many Requests)**:
- User exceeds 100 requests per minute
- Retry-After header indicates wait time

**Service Unavailable (503 Service Unavailable)**:
- Vector Search Engine is down (fallback to keyword search)
- AI Studio is overloaded (queue job for later processing)
- Telephony system is unavailable (provide direct contact info)

### Error Response Format

All errors follow a consistent JSON structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly error message",
    "details": [
      {
        "field": "email",
        "issue": "Invalid email format"
      }
    ],
    "requestId": "uuid-for-tracking"
  }
}
```

### Retry and Fallback Strategies

**Automatic Retries**:
- Failed API calls: 3 retries with exponential backoff (1s, 2s, 4s)
- Database connection failures: 5 retries with 500ms intervals
- External service calls: 2 retries with 2s intervals

**Fallback Mechanisms**:
- Vector search unavailable → Keyword-only search
- AI Studio fails → Display base model without customization
- Telephony connection fails → Display builder's direct contact
- Cache miss → Query database directly

**Circuit Breaker Pattern**:
- Open circuit after 5 consecutive failures
- Half-open state after 30 seconds
- Close circuit after 3 successful requests

### Error Logging and Monitoring

**Log Levels**:
- INFO: Successful operations, state changes
- WARNING: Degraded performance, fallback activations
- ERROR: Failed operations, validation errors
- CRITICAL: System failures, data corruption

**Monitoring Alerts**:
- ERROR rate > 5% over 5 minutes → Alert on-call engineer
- CRITICAL error → Immediate page to on-call engineer
- Service latency > 5 seconds → Alert DevOps team
- Database connection pool exhausted → Alert infrastructure team

## Testing Strategy

### Dual Testing Approach

The platform requires both unit testing and property-based testing for comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
- Specific user registration scenarios (valid email, invalid password)
- Edge cases in commission calculation (exactly $500K, exactly $1M)
- Error conditions (network failures, invalid inputs)
- Integration between services (search → lead scoring)

**Property-Based Tests**: Verify universal properties across all inputs
- All 80 correctness properties defined above
- Each property test runs minimum 100 iterations with randomized inputs
- Tests validate behavior holds for entire input space, not just examples

### Property-Based Testing Configuration

**Framework Selection**:
- TypeScript/JavaScript: fast-check
- Python: Hypothesis
- Java: jqwik
- Go: gopter

**Test Configuration**:
```typescript
// Example property test configuration
fc.assert(
  fc.property(
    fc.record({
      email: fc.emailAddress(),
      password: fc.string({ minLength: 8, maxLength: 50 })
    }),
    (user) => {
      // Test property 51: Password validation
      const result = validatePassword(user.password);
      const hasUppercase = /[A-Z]/.test(user.password);
      const hasNumber = /[0-9]/.test(user.password);
      const isLongEnough = user.password.length >= 8;
      
      return result.valid === (hasUppercase && hasNumber && isLongEnough);
    }
  ),
  { numRuns: 100 } // Minimum 100 iterations
);
```

**Property Test Tagging**:
Each property test must include a comment tag referencing the design document:
```typescript
// Feature: proptech-ecosystem, Property 51: Password Validation Rules
// Validates: Requirements 13.1
test('password validation enforces complexity rules', () => {
  // Property test implementation
});
```

### Test Coverage Goals

**Unit Test Coverage**:
- Minimum 80% code coverage
- 100% coverage of error handling paths
- All edge cases explicitly tested

**Property Test Coverage**:
- All 80 correctness properties implemented as property tests
- Each property maps to specific requirements
- Properties cover all testable acceptance criteria

### Testing Pyramid

```
        /\
       /  \
      / E2E \          10% - End-to-end tests (critical user flows)
     /______\
    /        \
   / Integr.  \       20% - Integration tests (service interactions)
  /____________\
 /              \
/   Unit + Prop  \    70% - Unit tests (30%) + Property tests (40%)
/__________________\
```

### Continuous Testing

**Pre-commit Hooks**:
- Run unit tests for changed files
- Run property tests for affected modules
- Lint and format code

**CI/CD Pipeline**:
1. Pull Request: Run all unit tests + affected property tests
2. Merge to main: Run full test suite (unit + property + integration)
3. Deploy to staging: Run E2E tests
4. Deploy to production: Run smoke tests

**Property Test Execution Time**:
- Each property test: ~1-5 seconds (100 iterations)
- Full property test suite: ~5-10 minutes (80 properties)
- Run property tests in parallel to reduce total time

### Test Data Generation

**Property Test Generators**:
- Users: Random email, password, role
- Properties: Random price ($50K-$5M), location, module type
- Behavior events: Random sequences of VIEW, SAVE, DESIGN, CALL
- Call transcripts: Random sentences with/without purchase keywords
- Timestamps: Random dates within valid ranges

**Boundary Value Testing**:
- Commission tiers: Test at $499,999, $500,000, $500,001
- Score thresholds: Test at 79, 80, 81 for "Hot" lead classification
- Rate limits: Test at 99, 100, 101 requests per minute
- Time windows: Test at 11 months 29 days, 12 months, 12 months 1 day

### Integration Testing

**Service Integration Tests**:
- Search Service → Lead Scoring Engine (view events trigger scoring)
- AI Studio → Lead Scoring Engine (design creation triggers scoring)
- Telephony Service → Lead Scoring Engine (call completion triggers scoring)
- Property Module Registry → Search Service (module activation affects search)
- Commission Ledger → Invoice Generation (transactions aggregate to invoices)

**External Service Mocking**:
- Mock AI world model API for 3D generation
- Mock VoIP provider for telephony testing
- Mock speech-to-text service for transcript generation
- Mock email service for notifications

### Performance Testing

**Load Testing Scenarios**:
- 10,000 concurrent users performing searches
- 1,000 concurrent 3D generation requests
- 500 concurrent phone calls
- Bulk property upload of 10,000 properties

**Performance Benchmarks**:
- Search response time: p95 < 2 seconds
- 3D generation: p95 < 20 seconds
- API endpoints: p95 < 500ms
- Database queries: p95 < 100ms

### Security Testing

**Security Test Cases**:
- SQL injection attempts in search queries
- XSS attempts in property descriptions
- CSRF token validation
- JWT token tampering detection
- Rate limiting bypass attempts
- Unauthorized access to protected endpoints
- PII encryption verification
- Call recording access control enforcement
