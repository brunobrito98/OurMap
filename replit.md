# OurMap - Event Management Platform

## Overview

OurMap is a modern event management platform built for discovering, creating, and attending local events. The application features a React frontend with TypeScript, an Express.js backend, and a PostgreSQL database using Drizzle ORM. The platform includes comprehensive event management capabilities, user authentication through Replit Auth, geolocation services, image upload functionality, and social features like friend connections and event ratings.

## Recent Changes

**September 25, 2025**
- **Replit Environment Setup**: Successfully configured application for Replit environment
  - tsx already installed and configured in package.json devDependencies
  - Vite configuration properly set with host "0.0.0.0" and port 5000
  - allowedHosts: true configured in server/vite.ts for Replit proxy support
  - Workflow configured with webview output type for frontend display
  - Application successfully running with Supabase database connection
  - Mapbox integration configured with VITE_MAPBOX_ACCESS_TOKEN
  - Deploy configuration set for autoscale deployment target
- **Environment Variables**: MAPBOX_ACCESS_TOKEN configured and working
  - Admin user creation pending ADMIN_USERNAME and ADMIN_PASSWORD secrets
  - Email functionality disabled (SENDGRID_API_KEY not required)
  - Application fully operational with existing database data

**September 24, 2025**
- **Event Lifecycle Management**: Successfully implemented filtering and restriction system for ended events
  - Modified backend `getEvents()` query to filter out events that have already ended from main screen
  - Enhanced filtering logic to check `endTime` if available, otherwise uses `dateTime` for event completion
  - Added validation to `/api/events/:id/attend` endpoint to prevent attendance changes on ended events
  - Updated `EventDetails.tsx` frontend component to disable attendance buttons for ended events
  - Added visual indicator showing "Evento Finalizado" (Event Ended) when event has concluded
  - Implemented real-time validation using event end time or start time comparison with current time
  - Enhanced user experience by preventing interactions with past events while maintaining data integrity
- **SMS Authentication Removal**: Successfully completed full removal of SMS authentication system
  - Removed all SMS authentication routes from backend (/api/auth/phone/start, /verify, /link)
  - Updated registration system to accept optional phone number field without verification requirements
  - Enhanced profile update route (/api/user/profile) to handle phone number updates and clearing
  - Simplified frontend authentication to credentials-only, removing SMS verification UI components
  - Fixed ChangePhone.tsx to allow simple phone number updates without SMS verification
  - Phone number is now purely optional contact information with no verification requirements
  - Maintained data consistency with phoneE164, phoneCountry, and phoneVerified fields in database
  - Application now functions completely without Twilio dependencies or SMS verification

**September 23, 2025**
- **Supabase Database Integration**: Successfully integrated Supabase PostgreSQL database as external data source
  - Configured database connection using DATABASE_URL secret with SSL mode
  - Resolved schema compatibility issues between existing Supabase tables and Drizzle schema definitions
  - Disabled unsupported features (crowdfunding, phone auth, notifications) due to missing database columns
  - Verified core functionality working: events, users, authentication, and basic operations
  - Maintained data integrity by preserving existing table structures without destructive migrations
- **Mapbox Integration**: Configured secure Mapbox token management through VITE_MAPBOX_ACCESS_TOKEN
  - Proper environment variable setup for frontend access to geolocation services
  - Maintained existing map functionality with external API key management
- **Schema Compatibility**: Aligned application schema with existing Supabase database structure
  - Commented out non-existent fields (price_type, phone_e164, notification preferences) to prevent SQL errors
  - Preserved existing data relationships and foreign key constraints
  - Ensured backward compatibility with current database state
- **Deployment Optimization**: Verified production readiness with external database integration
  - Application runs successfully with remote Supabase database connection
  - Maintained performance with optimized query patterns and connection pooling
- **Earlier Implementation**: Vaquinha (crowdfunding) feature was previously implemented but disabled due to schema mismatch
  - Feature remains in codebase but commented out pending database schema updates
  - Can be re-enabled once corresponding database columns are added to Supabase instance

**September 22, 2025**
- **Home Page Access**: Changed main route "/" from Landing (login page) to Home component for public access without authentication
- **Login Flow Optimization**: Implemented redirect parameters for seamless return to intended destinations after authentication
- **Security Enhancement**: Fixed open redirect vulnerability by validating redirect parameters in Landing component
- **Deep Link Support**: Enhanced URL preservation to capture complete paths (pathname + search + hash) for full deep link functionality
- **User Experience**: Users can now browse events freely without login, authentication only required for interactions (RSVP, profile access)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React with TypeScript**: Component-based UI architecture using functional components and hooks
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management and caching
- **UI Framework**: shadcn/ui components built on Radix UI primitives with Tailwind CSS
- **Form Handling**: React Hook Form with Zod validation schemas
- **Mobile-First Design**: Responsive design optimized for mobile devices with bottom navigation

### Backend Architecture
- **Express.js Server**: RESTful API with TypeScript support
- **Authentication**: Replit Auth with OpenID Connect integration and session management
- **File Upload**: Multer middleware for handling image uploads with validation
- **API Structure**: Modular route organization with centralized error handling
- **Session Storage**: PostgreSQL-backed session store using connect-pg-simple

### Database Design
- **PostgreSQL**: Primary database with Supabase hosting (external managed service)
- **ORM**: Drizzle ORM for type-safe database operations with schema compatibility layer
- **Schema Management**: Adaptive schema definitions aligned with existing Supabase database structure
- **Tables**: Users, events, event attendances, friendships, event ratings, and sessions (inherited from Supabase)
- **Relationships**: Proper foreign key relationships with type casting for compatibility between varchar and uuid fields

### Core Features
- **Event Management**: Full CRUD operations for events with image upload support
- **Geolocation Services**: Mapbox integration for geocoding addresses and interactive maps
- **User Profiles**: Complete user management with statistics and social connections
- **Attendance System**: RSVP functionality with status tracking
- **Rating System**: Post-event rating and review capabilities
- **Social Features**: Friend requests, connections, and social event discovery
- **Real-time Updates**: Optimistic updates with proper error handling

### Security & Authentication
- **Replit Auth Integration**: Secure OAuth-based authentication
- **Session Management**: Server-side session storage with PostgreSQL
- **Phone Authentication**: SMS verification with Twilio integration, OTP hashing with HMAC-SHA256
- **Data Protection**: Comprehensive sanitization of user data in API responses to prevent sensitive field exposure
- **Rate Limiting**: IP and phone-based rate limiting for authentication endpoints
- **File Upload Security**: Type and size validation for image uploads
- **API Security**: Authenticated route protection with middleware and sanitized data projections
- **Open Redirect Protection**: Landing page validates redirect parameters to prevent security vulnerabilities
- **Deep Link Preservation**: Full URL (pathname + search + hash) preservation for seamless post-login redirects

## External Dependencies

### Core Infrastructure
- **Supabase Database**: PostgreSQL hosting for production database with managed services
- **Replit Deployment**: Platform hosting and development environment with external database integration

### Third-Party Services
- **Mapbox**: Geocoding API and interactive maps (requires MAPBOX_ACCESS_TOKEN)
- **Replit Auth**: OAuth authentication service for user management

### Development Tools
- **Vite**: Frontend build tool and development server
- **ESBuild**: Backend bundling for production builds
- **Drizzle Kit**: Database migrations and schema management

### UI & Styling
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Component library built on Radix UI
- **Radix UI**: Headless UI primitives for accessibility
- **Lucide React**: Icon library for consistent iconography

### File Handling
- **Multer**: Server-side file upload handling
- **File System**: Local file storage with organized upload directory structure