# OurMap - Event Management Platform

## Overview

OurMap is a modern event management platform built for discovering, creating, and attending local events. The application features a React frontend with TypeScript, an Express.js backend, and a PostgreSQL database using Drizzle ORM. The platform includes comprehensive event management capabilities, user authentication through Replit Auth, geolocation services, image upload functionality, and social features like friend connections and event ratings.

## Recent Changes

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
- **Vaquinha (Crowdfunding) Feature Implementation**: Successfully implemented complete crowdfunding system for events
  - Updated database schema with new crowdfunding fields (priceType, fundraisingGoal, minimumContribution) and eventContributions table
  - Enhanced event creation form with third pricing option "Vaquinha" alongside Free/Paid events
  - Implemented contribution modal with amount input, minimum value validation, and public/private contribution option
  - Added visual progress bar showing fundraising goal progress with gradient styling and percentage completion
  - Built backend API routes for creating contributions, fetching totals, and managing crowdfunding data
  - Integrated auto-confirmation of attendance when contributing to crowdfunding events
  - Added notification system for event organizers when receiving new contributions
  - Enhanced event details page with fundraising progress visualization and appropriate call-to-action buttons
- **GitHub Project Import**: Successfully imported the OurMap project to Replit environment
- **Environment Setup**: Configured development workflow with npm run dev on port 5000
- **Dependencies**: Verified all packages are correctly installed and compatible
- **Replit Configuration**: Confirmed proper host settings (0.0.0.0) and proxy configuration for frontend
- **Deployment Setup**: Configured autoscale deployment with build and start commands
- **Secret Configuration**: Set up environment secrets for full application functionality

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
- **PostgreSQL**: Primary database with Neon serverless hosting
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Centralized schema definitions with TypeScript types
- **Tables**: Users, events, event attendances, friendships, event ratings, and sessions
- **Relationships**: Proper foreign key relationships with relational queries

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
- **Neon Database**: PostgreSQL hosting for production database
- **Replit Deployment**: Platform hosting and development environment

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