# Implementation Plan: PropTech Ecosystem Platform

## Overview

This implementation plan breaks down the PropTech Ecosystem Platform into discrete, incremental coding tasks. The platform is built using TypeScript/Node.js for backend services, React with TypeScript for frontend applications, and PostgreSQL with pgvector for data storage. The implementation follows a modular architecture enabling independent development of User, Builder, and Admin subsystems while maintaining integration through shared core services.

## Tasks

- [ ] 1. Set up project infrastructure and core database schema
  - Initialize monorepo structure with TypeScript, Node.js, React
  - Configure PostgreSQL database with pgvector extension
  - Create core database tables: users, sessions, partners, properties, property_modules
  - Set up Redis for caching and job queues
  - Configure environment variables and secrets management
  - _Requirements: 13.1, 13.2, 12.1_

- [ ] 2. Implement authentication and authorization system
  - [ ] 2.1 Create user registration with email/password validation
    - Implement password hashing with bcrypt (12 salt rounds)
    - Validate email format and password complexity rules
    - Store user records with role assignment
    - _Requirements: 13.1_
  
  - [ ]* 2.2 Write property tests for registration validation
    - **Property 51: Password Validation Rules**
    - **Property 52: Email Format Validation**
    - **Validates: Requirements 13.1**
  
  - [ ] 2.3 Implement JWT-based session management
    - Generate JWT tokens with HS256 signing
    - Set 24-hour expiration for access tokens
    - Implement refresh token mechanism with 30-day expiration
    - _Requirements: 13.2_
  
  - [ ]* 2.4 Write property tests for session token expiration
    - **Property 53: Session Token Expiration**
    - **Validates: Requirements 13.2, 13.4**
  
  - [ ] 2.5 Implement role-based access control middleware
    - Create authorization middleware for protected routes
    - Enforce role restrictions (USER, BUILDER, ADMIN)
    - _Requirements: 13.3_
  
  - [ ]* 2.6 Write property tests for RBAC enforcement
    - **Property 54: Role-Based Access Control**
    - **Validates: Requirements 13.3**
  
  - [ ] 2.7 Implement MFA for Builder and Admin roles
    - Generate TOTP secrets for MFA enrollment
    - Verify TOTP codes during login
    - _Requirements: 13.5_
  
  - [ ]* 2.8 Write property tests for MFA enforcement
    - **Property 55: MFA Enforcement for Privileged Roles**
    - **Validates: Requirements 13.5**


- [ ] 3. Build Property Module Registry system
  - [ ] 3.1 Create module registry service with CRUD operations
    - Implement module registration with schema validation
    - Store module configurations in property_modules table
    - Support dynamic schema extension with JSONB fields
    - _Requirements: 12.1, 12.5_
  
  - [ ]* 3.2 Write property tests for module registry
    - **Property 47: Module Schema Extension**
    - **Property 50: Module Registry Integrity**
    - **Validates: Requirements 12.1, 12.5**
  
  - [ ] 3.3 Implement Apartment module as reference implementation
    - Define Apartment module schema (bedrooms, bathrooms, sqft, floor, amenities)
    - Register Apartment module in registry
    - Create validation logic for Apartment-specific fields
    - _Requirements: 1.5, 4.5_
  
  - [ ] 3.4 Create module-based property operation routing
    - Implement router that directs operations to appropriate module handlers
    - Support create, read, update, delete operations per module
    - _Requirements: 12.3_
  
  - [ ]* 3.5 Write property tests for module routing
    - **Property 48: Module-Based Operation Routing**
    - **Validates: Requirements 12.3**

- [ ] 4. Implement Vector Search Engine
  - [ ] 4.1 Set up OpenAI embeddings integration
    - Configure OpenAI API client for text-embedding-3-small model
    - Create embedding generation service for property descriptions
    - Store embeddings in properties table (vector(1536) column)
    - _Requirements: 1.2_
  
  - [ ] 4.2 Implement hybrid search functionality
    - Create keyword search using PostgreSQL full-text search
    - Implement vector similarity search using pgvector cosine distance
    - Combine results with 0.6 semantic + 0.4 keyword weighting
    - _Requirements: 1.1, 1.2_
  
  - [ ]* 4.3 Write property tests for search correctness
    - **Property 1: Keyword Search Correctness**
    - **Property 2: Vector Search Threshold Enforcement**
    - **Validates: Requirements 1.1, 1.2**
  
  - [ ] 4.4 Implement search filters and pagination
    - Add filter support for price range, location, property type, module type
    - Implement pagination with 20 results per page
    - _Requirements: 1.4, 1.6_
  
  - [ ]* 4.5 Write property tests for filters and pagination
    - **Property 4: Filter Application Correctness**
    - **Property 6: Pagination Consistency**
    - **Validates: Requirements 1.4, 1.6**
  
  - [ ] 4.6 Implement search result caching
    - Cache search results in Redis with 5-minute TTL
    - Use query parameters as cache key
    - _Requirements: 15.2_
  
  - [ ]* 4.7 Write property tests for caching behavior
    - **Property 62: Search Result Caching**
    - **Validates: Requirements 15.2**

- [ ] 5. Checkpoint - Ensure core services are functional
  - Verify authentication flow works end-to-end
  - Verify module registry can register and retrieve modules
  - Verify search returns results with proper filtering
  - Ensure all tests pass, ask the user if questions arise

- [ ] 6. Build AI Studio service for 3D customization
  - [ ] 6.1 Set up Luma AI Genie integration
    - Configure Luma AI API client with authentication
    - Implement text-to-3D generation endpoint integration
    - Implement image-to-3D generation endpoint integration
    - Handle polling for generation status
    - _Requirements: 2.2, 2.3_
  
  - [ ] 6.2 Create 3D model storage and retrieval
    - Store base 3D models in S3/R2 object storage
    - Create models_3d table for model metadata
    - Implement CDN integration for fast model delivery
    - _Requirements: 2.1_
  
  - [ ] 6.3 Implement design asset management
    - Create design_assets table for user customizations
    - Store customization prompts and generated model URLs
    - Track design status (PENDING, FEASIBLE, REQUIRES_ADJUSTMENT)
    - _Requirements: 2.4, 6.3, 6.4_
  
  - [ ]* 6.4 Write property tests for design asset persistence
    - **Property 7: Design Asset Persistence**
    - **Property 8: Design Status Transitions**
    - **Validates: Requirements 2.4, 6.3, 6.4**
  
  - [ ] 6.5 Implement asynchronous job queue for 3D generation
    - Set up Bull queue with Redis backend
    - Create worker processes for 3D generation jobs
    - Implement 30-second timeout with fallback to base model
    - _Requirements: 15.5_
  
  - [ ]* 6.6 Write property tests for async processing
    - **Property 64: Asynchronous AI Task Processing**
    - **Validates: Requirements 15.5**
  
  - [ ] 6.7 Implement error handling for generation failures
    - Preserve previous valid model state on failure
    - Return user-friendly error messages
    - _Requirements: 2.6, 20.3_
  
  - [ ]* 6.8 Write property tests for error recovery
    - **Property 67: AI Studio Error Recovery**
    - **Validates: Requirements 2.6, 20.3**

- [ ] 7. Implement Telephony Service
  - [ ] 7.1 Set up Twilio integration for VoIP
    - Configure Twilio API client
    - Implement toll-free number provisioning
    - Create toll_free_numbers table for number assignments
    - _Requirements: 9.1_
  
  - [ ] 7.2 Implement call routing logic
    - Map toll-free numbers to builder phone lines
    - Initiate outbound calls via Twilio
    - Play consent disclosure message before recording
    - _Requirements: 3.1, 9.2, 18.1_
  
  - [ ]* 7.3 Write property tests for call routing
    - **Property 37: Toll-Free Number Routing**
    - **Validates: Requirements 9.2**
  
  - [ ] 7.4 Implement call recording with consent enforcement
    - Check user consent flag before enabling recording
    - Store recordings in S3 with encryption
    - Create call_records table for call metadata
    - _Requirements: 3.2, 18.2, 18.3_
  
  - [ ]* 7.5 Write property tests for consent enforcement
    - **Property 11: Call Recording Consent Enforcement**
    - **Validates: Requirements 3.2, 18.2**
  
  - [ ] 7.6 Implement call transcription integration
    - Integrate AWS Transcribe or Google Speech-to-Text
    - Store transcripts with call records
    - _Requirements: 5.2_
  
  - [ ] 7.7 Implement call recording access control and audit logging
    - Restrict access to authorized admins and associated builder
    - Log all recording access events
    - _Requirements: 18.3, 18.6_
  
  - [ ]* 7.8 Write property tests for access control and audit
    - **Property 14: Call Recording Access Control**
    - **Property 16: Call Recording Access Audit**
    - **Validates: Requirements 18.3, 18.6**
  
  - [ ] 7.9 Implement automatic call recording deletion
    - Create scheduled job to delete recordings older than 90 days
    - Respect dispute resolution flags
    - _Requirements: 18.4_
  
  - [ ]* 7.10 Write property tests for auto-deletion
    - **Property 15: Call Recording Auto-Deletion**
    - **Validates: Requirements 18.4**

- [ ] 8. Build Lead Scoring Engine
  - [ ] 8.1 Create behavior event tracking system
    - Create behavior_events table for user actions
    - Implement event ingestion API (VIEW, SAVE, DESIGN, CALL)
    - _Requirements: 5.1_
  
  - [ ] 8.2 Implement base scoring rules
    - Calculate scores: VIEW=20, SAVE=30, DESIGN=40, CALL=50
    - Create leads table with score tracking
    - Update scores on each behavior event
    - _Requirements: 16.1, 16.2, 16.3, 16.4_
  
  - [ ]* 8.3 Write property tests for behavioral scoring
    - **Property 22: Behavioral Event Scoring**
    - **Validates: Requirements 16.1, 16.2, 16.3, 16.4, 5.1**
  
  - [ ] 8.4 Implement call transcript analysis for lead scoring
    - Extract purchase intent keywords from transcripts
    - Calculate keyword frequency and sentiment
    - Add 0-20 bonus points based on analysis
    - _Requirements: 16.5, 5.2_
  
  - [ ]* 8.5 Write property tests for transcript scoring
    - **Property 23: Call Transcript Keyword Scoring**
    - **Validates: Requirements 16.5, 5.2**
  
  - [ ] 8.6 Implement score decay mechanism
    - Create scheduled job to decay scores by 10% per week of inactivity
    - Run daily to update stale lead scores
    - _Requirements: 16.6_
  
  - [ ]* 8.7 Write property tests for score decay
    - **Property 24: Score Decay Over Time**
    - **Validates: Requirements 16.6**
  
  - [ ] 8.8 Implement hot lead classification
    - Mark leads with score >= 80 as "HOT" status
    - Update lead status automatically on score changes
    - _Requirements: 5.6_
  
  - [ ]* 8.9 Write property tests for hot lead classification
    - **Property 26: Hot Lead Classification**
    - **Validates: Requirements 5.6**

- [ ] 9. Checkpoint - Verify AI and telephony integration
  - Test 3D generation end-to-end with Luma AI
  - Test call routing and recording with Twilio
  - Verify lead scores update correctly from events
  - Ensure all tests pass, ask the user if questions arise

- [ ] 10. Implement Commission Ledger system
  - [ ] 10.1 Create transaction recording system
    - Create transactions table for sales and design purchases
    - Implement transaction recording API
    - _Requirements: 10.1, 10.2_
  
  - [ ] 10.2 Implement tiered commission calculation
    - Calculate rates: 2% (<$500K), 1.5% ($500K-$1M), 1% (>$1M)
    - Apply new partner waiver (first 3 sales)
    - Handle currency consistency
    - _Requirements: 17.1, 17.3, 17.4, 17.5_
  
  - [ ]* 10.3 Write property tests for commission calculation
    - **Property 40: Tiered Commission Calculation**
    - **Property 42: New Partner Commission Waiver**
    - **Property 43: Commission Currency Consistency**
    - **Validates: Requirements 17.1, 17.3, 17.4, 17.5, 10.1**
  
  - [ ] 10.4 Implement design service fee allocation
    - Calculate $50 fee with 70/30 split (builder/platform)
    - Record design purchase transactions
    - _Requirements: 17.2, 10.2_
  
  - [ ]* 10.5 Write property tests for fee allocation
    - **Property 41: Design Service Fee Split**
    - **Validates: Requirements 17.2, 10.2**
  
  - [ ] 10.6 Implement monthly invoice generation
    - Create invoices table
    - Create scheduled job to generate invoices on 1st of month
    - Aggregate previous month's transactions per partner
    - _Requirements: 17.6, 10.6_
  
  - [ ]* 10.7 Write property tests for invoice generation
    - **Property 44: Monthly Invoice Generation**
    - **Validates: Requirements 17.6, 10.6**

- [ ] 11. Build User Dashboard and frontend
  - [ ] 11.1 Create React app structure with TypeScript
    - Set up React with TypeScript and React Router
    - Configure Three.js/React Three Fiber for 3D rendering
    - Set up state management (Redux or Zustand)
    - _Requirements: 2.5, 19.1_
  
  - [ ] 11.2 Implement property search interface
    - Create search bar with keyword and semantic query support
    - Implement filter controls (price, location, type)
    - Display search results with property cards
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [ ]* 11.3 Write property tests for search result rendering
    - **Property 3: Search Result Completeness**
    - **Validates: Requirements 1.3**
  
  - [ ] 11.4 Implement AI Studio 3D viewer
    - Load and render GLB models using Three.js
    - Implement navigation controls (rotate, zoom, pan)
    - Create text prompt input for customization
    - Create image upload for style transfer
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  
  - [ ] 11.5 Implement saved properties feature
    - Create saved properties list view
    - Implement save/unsave property actions
    - Display timestamps for saved items
    - _Requirements: 3.5_
  
  - [ ]* 11.6 Write property tests for saved properties
    - **Property 71: User Saved Properties Persistence**
    - **Validates: Requirements 3.5**
  
  - [ ] 11.7 Implement call history view
    - Display call records with duration, timestamp, property
    - Filter to show only last 12 months
    - _Requirements: 3.3, 3.6_
  
  - [ ]* 11.8 Write property tests for call history filtering
    - **Property 13: Call History Time Window**
    - **Validates: Requirements 3.6**
  
  - [ ] 11.9 Implement user dashboard navigation
    - Create navigation bar with Search, AI Studio, Saved Properties, Call History
    - Implement breadcrumb navigation
    - _Requirements: 19.1, 19.6_
  
  - [ ]* 11.10 Write property tests for navigation
    - **Property 73: Role-Based Navigation** (User portion)
    - **Property 74: Breadcrumb Path Correctness**
    - **Validates: Requirements 19.1, 19.6**

- [ ] 12. Build Builder Dashboard and frontend
  - [ ] 12.1 Implement inventory management interface
    - Display properties grouped by module type
    - Create property creation form with validation
    - Implement property update and status change
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ]* 12.2 Write property tests for inventory management
    - **Property 17: Inventory Organization by Module**
    - **Property 18: Property Validation on Creation**
    - **Property 19: Property Status Filtering**
    - **Validates: Requirements 4.1, 4.2, 4.4**
  
  - [ ] 12.3 Implement bulk property upload
    - Create CSV upload interface
    - Parse and validate CSV data
    - Display validation feedback for errors
    - _Requirements: 4.6_
  
  - [ ]* 12.4 Write property tests for bulk upload
    - **Property 21: Bulk Upload Validation**
    - **Validates: Requirements 4.6**
  
  - [ ] 12.5 Implement AI Lead Inbox
    - Display leads sorted by Purchase_Intent_Score
    - Show lead cards with user info, property, score, activity
    - Highlight "HOT" leads (score >= 80)
    - _Requirements: 5.4, 5.5, 5.6_
  
  - [ ]* 12.6 Write property tests for lead inbox
    - **Property 25: Lead Sorting by Score**
    - **Property 27: Lead Card Completeness**
    - **Validates: Requirements 5.4, 5.5**
  
  - [ ] 12.7 Implement design review interface
    - Display pending design assets
    - Show 3D visualization with user prompts
    - Implement feasibility marking with feedback
    - Filter designs by status
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_
  
  - [ ]* 12.8 Write property tests for design review
    - **Property 9: Design Review Completeness**
    - **Property 10: Design Filter Correctness**
    - **Validates: Requirements 6.2, 6.6**
  
  - [ ] 12.9 Implement performance analytics dashboard
    - Display total leads, conversion rate, revenue metrics
    - Show lead source breakdown (search, 3D studio, telephony)
    - Create time-series graphs (30, 90, 365 days)
    - Implement CSV/PDF export
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [ ]* 12.10 Write property tests for analytics
    - **Property 28: Conversion Rate Calculation**
    - **Property 29: Lead Source Attribution**
    - **Property 31: Analytics Export Completeness**
    - **Validates: Requirements 7.3, 7.4, 7.6**
  
  - [ ] 12.11 Implement builder dashboard navigation
    - Create navigation bar with Inventory, Lead Inbox, Design Review, Analytics
    - _Requirements: 19.2_

- [ ] 13. Build Admin Dashboard and frontend
  - [ ] 13.1 Implement partner onboarding interface
    - Create partner application form
    - Display verification checklist for admins
    - Implement approve/reject actions with reason tracking
    - Display partner directory with status filtering
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ]* 13.2 Write property tests for partner management
    - **Property 33: Partner Application Validation**
    - **Property 34: Partner Approval Workflow**
    - **Property 35: Partner Rejection Recording**
    - **Validates: Requirements 8.1, 8.3, 8.4**
  
  - [ ] 13.3 Implement partner suspension/reactivation with audit
    - Create suspend/reactivate actions
    - Log all status changes with admin user and timestamp
    - _Requirements: 8.6_
  
  - [ ]* 13.4 Write property tests for audit trail
    - **Property 36: Partner Status Audit Trail**
    - **Validates: Requirements 8.6**
  
  - [ ] 13.5 Implement telephony management dashboard
    - Display toll-free number assignments
    - Show call volumes and routing status
    - Implement number assignment interface
    - Log configuration changes
    - _Requirements: 9.1, 9.3, 9.5_
  
  - [ ]* 13.6 Write property tests for telephony management
    - **Property 38: Telephony Configuration Audit**
    - **Validates: Requirements 9.5**
  
  - [ ] 13.7 Implement call failure rate monitoring and alerting
    - Calculate failure rates per builder
    - Alert when failure rate > 5%
    - _Requirements: 9.6_
  
  - [ ]* 13.8 Write property tests for failure rate alerting
    - **Property 39: Call Failure Rate Alerting**
    - **Validates: Requirements 9.6**
  
  - [ ] 13.9 Implement financial dashboard
    - Display total revenue, pending commissions, paid commissions
    - Show commission reports with transaction details
    - Support configurable commission rates per partner
    - _Requirements: 10.3, 10.4, 10.5_
  
  - [ ]* 13.10 Write property tests for financial reporting
    - **Property 45: Financial Summary Accuracy**
    - **Property 46: Commission Report Completeness**
    - **Validates: Requirements 10.3, 10.4**
  
  - [ ] 13.11 Implement AI system monitoring dashboard
    - Display Vector Search metrics (volume, latency, errors)
    - Display AI Studio metrics (success rate, avg time, failures)
    - Show trending search terms and customization prompts
    - _Requirements: 11.1, 11.2, 11.6_
  
  - [ ]* 13.12 Write property tests for AI monitoring
    - **Property 75: Vector Search Metrics Aggregation**
    - **Property 76: AI Studio Success Rate Calculation**
    - **Property 80: Trending Analysis Correctness**
    - **Validates: Requirements 11.1, 11.2, 11.6**
  
  - [ ] 13.13 Implement AI system alerting
    - Alert on 5 consecutive Vector Search queries > 3s latency
    - Alert on AI Studio failure rate > 10% in 1-hour window
    - _Requirements: 11.3, 11.4_
  
  - [ ]* 13.14 Write property tests for AI alerting
    - **Property 77: Consecutive Latency Threshold Alerting**
    - **Property 78: Time-Windowed Failure Rate Alerting**
    - **Validates: Requirements 11.3, 11.4**
  
  - [ ] 13.15 Implement admin dashboard navigation
    - Create navigation bar with Partners, Telephony, Finance, AI Monitoring
    - _Requirements: 19.3_

- [ ] 14. Checkpoint - Verify all dashboards are functional
  - Test User dashboard end-to-end (search, 3D studio, saved properties, calls)
  - Test Builder dashboard end-to-end (inventory, leads, designs, analytics)
  - Test Admin dashboard end-to-end (partners, telephony, finance, monitoring)
  - Ensure all tests pass, ask the user if questions arise

- [ ] 15. Implement data privacy and compliance features
  - [ ] 15.1 Implement consent management
    - Add consent checkboxes to registration form
    - Store consent flags in user records
    - Enforce consent requirements before data processing
    - _Requirements: 14.1, 18.2_
  
  - [ ]* 15.2 Write property tests for consent enforcement
    - **Property 57: Registration Consent Requirement**
    - **Validates: Requirements 14.1**
  
  - [ ] 15.3 Implement PII encryption at rest
    - Encrypt sensitive fields (email, phone, addresses) using AES-256
    - Create encryption/decryption utilities
    - _Requirements: 14.2_
  
  - [ ]* 15.4 Write property tests for PII encryption
    - **Property 58: PII Encryption at Rest**
    - **Validates: Requirements 14.2**
  
  - [ ] 15.5 Implement data deletion functionality
    - Create user data deletion API
    - Remove all personal data while retaining anonymized analytics
    - Process deletions within 30-day window
    - _Requirements: 14.4_
  
  - [ ]* 15.6 Write property tests for data deletion
    - **Property 59: Data Deletion Completeness**
    - **Validates: Requirements 14.4**
  
  - [ ] 15.7 Implement data export functionality
    - Create user data export API
    - Generate JSON export of all user data
    - Deliver within 48 hours
    - _Requirements: 14.5_
  
  - [ ]* 15.8 Write property tests for data export
    - **Property 60: Data Export Format**
    - **Validates: Requirements 14.5**
  
  - [ ] 15.9 Implement data access audit logging
    - Log all access to personal data
    - Include accessor, data type, subject user, timestamp
    - _Requirements: 14.6_
  
  - [ ]* 15.10 Write property tests for access audit
    - **Property 61: Data Access Audit Logging**
    - **Validates: Requirements 14.6**

- [ ] 16. Implement error handling and resilience
  - [ ] 16.1 Implement API retry logic with exponential backoff
    - Retry failed requests up to 3 times
    - Use exponential backoff (1s, 2s, 4s)
    - _Requirements: 20.1_
  
  - [ ]* 16.2 Write property tests for retry logic
    - **Property 65: API Retry Logic**
    - **Validates: Requirements 20.1**
  
  - [ ] 16.3 Implement service fallback mechanisms
    - Vector Search unavailable → keyword-only search
    - AI Studio fails → display base model
    - Telephony fails → display direct contact
    - _Requirements: 20.2, 20.3, 20.4_
  
  - [ ]* 16.4 Write property tests for fallback behavior
    - **Property 66: Vector Search Fallback**
    - **Property 67: AI Studio Error Recovery**
    - **Property 68: Telephony Fallback Information**
    - **Validates: Requirements 20.2, 20.3, 20.4**
  
  - [ ] 16.5 Implement comprehensive error logging
    - Log errors with severity levels (INFO, WARNING, ERROR, CRITICAL)
    - Include timestamp, context, and error details
    - Sanitize error messages for user display
    - _Requirements: 20.5, 20.6_
  
  - [ ]* 16.6 Write property tests for error logging
    - **Property 69: Error Logging with Severity**
    - **Property 70: Error Message Sanitization**
    - **Validates: Requirements 20.5, 20.6**
  
  - [ ] 16.7 Implement rate limiting
    - Limit users to 100 requests per minute
    - Return 429 status code when exceeded
    - _Requirements: 15.4_
  
  - [ ]* 16.8 Write property tests for rate limiting
    - **Property 63: Rate Limiting Enforcement**
    - **Validates: Requirements 15.4**

- [ ] 17. Implement cross-module search integration
  - [ ] 17.1 Update search service to query all active modules
    - Query properties from all active module types
    - Merge and rank results across modules
    - _Requirements: 12.4_
  
  - [ ]* 17.2 Write property tests for cross-module search
    - **Property 5: Module Integration in Search**
    - **Property 49: Cross-Module Search Aggregation**
    - **Validates: Requirements 1.5, 12.4**

- [ ] 18. Final integration and end-to-end testing
  - [ ] 18.1 Implement authentication event logging
    - Log all login, logout, and failed authentication attempts
    - _Requirements: 13.6_
  
  - [ ]* 18.2 Write property tests for auth logging
    - **Property 56: Authentication Event Logging**
    - **Validates: Requirements 13.6**
  
  - [ ] 18.3 Implement audit logging for all critical operations
    - Log partner status changes, telephony config, commission rates
    - _Requirements: 8.6, 9.5, 10.5_
  
  - [ ]* 18.4 Write integration tests for end-to-end user flows
    - Test complete user journey: search → view → customize → call → save
    - Test complete builder journey: add property → receive lead → review design → convert
    - Test complete admin journey: onboard partner → assign number → monitor metrics

- [ ] 19. Final checkpoint - Complete system verification
  - Run full test suite (unit + property + integration)
  - Verify all 80 correctness properties pass
  - Test all three dashboards with real data
  - Verify error handling and fallback mechanisms
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- Checkpoints ensure incremental validation at major milestones
- The implementation uses TypeScript for type safety across frontend and backend
- Three.js/React Three Fiber provides 3D rendering capabilities
- Luma AI Genie handles AI-powered 3D generation
- PostgreSQL with pgvector enables semantic search
- Twilio provides telephony infrastructure
