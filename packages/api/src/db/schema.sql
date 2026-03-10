-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  refresh_token VARCHAR(500) UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Partners (Builders)
CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  business_license VARCHAR(255),
  tax_id VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED')),
  rejection_reason TEXT,
  onboarded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_partners_user_id ON partners(user_id);
CREATE INDEX idx_partners_status ON partners(status);

-- Property Module Registry
CREATE TABLE property_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) UNIQUE NOT NULL,
  version VARCHAR(20) NOT NULL,
  schema JSONB NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_property_modules_type ON property_modules(type);
CREATE INDEX idx_property_modules_active ON property_modules(active);

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

CREATE INDEX idx_properties_builder_id ON properties(builder_id);
CREATE INDEX idx_properties_module_type ON properties(module_type);
CREATE INDEX idx_properties_location ON properties(location);
CREATE INDEX idx_properties_price ON properties(price);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_embedding ON properties USING ivfflat (embedding vector_cosine_ops);

-- 3D Models and Design Assets
CREATE TABLE models_3d (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  mesh_url VARCHAR(500) NOT NULL,
  texture_urls TEXT[],
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_models_3d_property_id ON models_3d(property_id);

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

CREATE INDEX idx_design_assets_user_id ON design_assets(user_id);
CREATE INDEX idx_design_assets_property_id ON design_assets(property_id);
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

CREATE INDEX idx_toll_free_numbers_builder_id ON toll_free_numbers(builder_id);
CREATE INDEX idx_toll_free_numbers_number ON toll_free_numbers(number);

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

CREATE INDEX idx_call_records_user_id ON call_records(user_id);
CREATE INDEX idx_call_records_builder_id ON call_records(builder_id);
CREATE INDEX idx_call_records_started_at ON call_records(started_at);

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
CREATE INDEX idx_behavior_events_created_at ON behavior_events(created_at);

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
CREATE INDEX idx_leads_user_property ON leads(user_id, property_id);

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

CREATE INDEX idx_transactions_builder_id ON transactions(builder_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

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

CREATE INDEX idx_invoices_builder_id ON invoices(builder_id);
CREATE INDEX idx_invoices_month_year ON invoices(month, year);

-- User Saved Properties
CREATE TABLE saved_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

CREATE INDEX idx_saved_properties_user_id ON saved_properties(user_id);

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

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Insert default Apartment module
INSERT INTO property_modules (type, version, schema, active) VALUES (
  'APARTMENT',
  '1.0.0',
  '{
    "fields": [
      {"name": "bedrooms", "type": "number", "required": true},
      {"name": "bathrooms", "type": "number", "required": true},
      {"name": "sqft", "type": "number", "required": true},
      {"name": "floor", "type": "number", "required": false},
      {"name": "building_name", "type": "string", "required": false},
      {"name": "amenities", "type": "json", "required": false},
      {"name": "parking_spaces", "type": "number", "required": false}
    ]
  }',
  TRUE
);
