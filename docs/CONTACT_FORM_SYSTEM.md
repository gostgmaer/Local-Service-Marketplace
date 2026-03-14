# Contact Form System Implementation

## Overview

A complete contact form system has been implemented for the Local Service Marketplace platform. This allows users (both authenticated and guest visitors) to submit inquiries, which are stored in the database and can be managed by administrators.

---

## Database Schema

### Table: `contact_messages`

**Location:** `database/schema.sql`

```sql
CREATE TABLE contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  subject VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_notes TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP,
  resolved_at TIMESTAMP
);
```

**Indexes:**
- `idx_contact_messages_status` - Query by status
- `idx_contact_messages_email` - Query by email
- `idx_contact_messages_user_id` - Query by user (if authenticated)
- `idx_contact_messages_assigned_to` - Query by assigned admin
- `idx_contact_messages_created_at` - Sort by creation date

**Trigger:**
- `update_contact_messages_updated_at` - Auto-update `updated_at` field

---

## Backend Implementation

### Service: Admin Service

**Port:** 3010  
**Base Path:** `/admin`

### Files Created/Modified

#### 1. Entity
**File:** `services/admin-service/src/admin/entities/contact-message.entity.ts`

```typescript
export class ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  user_id?: string;
  assigned_to?: string;
  admin_notes?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
  updated_at?: Date;
  resolved_at?: Date;
}
```

#### 2. DTOs
**File:** `services/admin-service/src/admin/dto/create-contact-message.dto.ts`

```typescript
export class CreateContactMessageDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  subject: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  message: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsString()
  ip_address?: string;

  @IsOptional()
  @IsString()
  user_agent?: string;
}
```

**File:** `services/admin-service/src/admin/dto/update-contact-message.dto.ts`

```typescript
export class UpdateContactMessageDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['new', 'in_progress', 'resolved', 'closed'])
  status: string;

  @IsOptional()
  @IsString()
  admin_notes?: string;

  @IsOptional()
  @IsUUID()
  assigned_to?: string;
}
```

#### 3. Repository
**File:** `services/admin-service/src/admin/repositories/contact-message.repository.ts`

**Methods:**
- `createContactMessage(dto)` - Create new contact message
- `getContactMessageById(id)` - Get message by ID
- `getAllContactMessages(limit, offset, status?)` - Get all messages with optional status filter
- `getContactMessageCount(status?)` - Count messages
- `getContactMessagesByEmail(email)` - Get messages by email
- `getContactMessagesByUserId(userId)` - Get messages by user
- `updateContactMessage(id, dto)` - Update message (status, notes, assignment)
- `deleteContactMessage(id)` - Delete message

#### 4. Service
**File:** `services/admin-service/src/admin/services/contact-message.service.ts`

**Features:**
- Business logic layer
- Audit logging for all operations
- Exception handling (NotFoundException)
- Winston logger integration

#### 5. Controller
**File:** `services/admin-service/src/admin/admin.controller.ts`

**Endpoints Added:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/admin/contact` | Submit contact form | No (Public) |
| GET | `/admin/contact` | List all messages (with pagination & filtering) | Yes (Admin) |
| GET | `/admin/contact/:id` | Get message by ID | Yes (Admin) |
| GET | `/admin/contact/email/:email` | Get messages by email | Yes (Admin) |
| GET | `/admin/contact/user/:userId` | Get messages by user | Yes (Admin) |
| PATCH | `/admin/contact/:id` | Update message status/notes | Yes (Admin) |
| DELETE | `/admin/contact/:id` | Delete message | Yes (Admin) |

#### 6. Module
**File:** `services/admin-service/src/admin/admin.module.ts`

- Added `ContactMessageService` to providers
- Added `ContactMessageRepository` to providers
- Exported `ContactMessageService`

---

## API Gateway Configuration

### Routing

**File:** `api-gateway/src/gateway/config/services.config.ts`

**Service Config:**
```typescript
admin: {
  url: process.env.ADMIN_SERVICE_URL || 'http://localhost:3010',
  name: 'admin-service',
}
```

**Route Mapping:**
```typescript
'/admin': 'admin'
```

**Public Routes Added:**
```typescript
"/api/v1/admin/contact"  // Contact form submission - public access
```

This means anyone can POST to `/api/v1/admin/contact` without authentication, but all GET/PATCH/DELETE operations require admin authentication.

---

## Frontend Implementation

### Contact Page

**File:** `frontend/nextjs-app/app/contact/page.tsx`

**Features:**
- React Hook Form with Zod validation
- Real-time form validation
- Dark/light theme support
- Toast notifications for success/error
- Axios API integration
- IP address and User-Agent tracking (automatic)

**Form Fields:**
- Name (min 2 chars, max 255)
- Email (valid email format)
- Subject (min 5 chars, max 500)
- Message (min 10 chars)

**API Endpoint:**
```typescript
POST ${API_URL}/api/v1/admin/contact
```

**Validation Schema:**
```typescript
const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});
```

---

## API Usage Examples

### 1. Submit Contact Form (Public)

**Request:**
```bash
POST http://localhost:3500/api/v1/admin/contact
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Question about services",
  "message": "I would like to know more about your cleaning services."
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Question about services",
  "message": "I would like to know more about your cleaning services.",
  "status": "new",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2024-03-14T10:30:00.000Z"
}
```

### 2. List Contact Messages (Admin Only)

**Request:**
```bash
GET http://localhost:3500/api/v1/admin/contact?limit=20&offset=0&status=new
Authorization: Bearer <admin-token>
x-admin-id: <admin-user-id>
```

**Response:**
```json
{
  "messages": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "email": "john@example.com",
      "subject": "Question about services",
      "message": "I would like to know more...",
      "status": "new",
      "created_at": "2024-03-14T10:30:00.000Z"
    }
  ],
  "total": 15
}
```

### 3. Update Contact Message Status (Admin Only)

**Request:**
```bash
PATCH http://localhost:3500/api/v1/admin/contact/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <admin-token>
x-admin-id: <admin-user-id>
Content-Type: application/json

{
  "status": "in_progress",
  "admin_notes": "Investigating the issue",
  "assigned_to": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Question about services",
  "message": "I would like to know more...",
  "status": "in_progress",
  "assigned_to": "660e8400-e29b-41d4-a716-446655440001",
  "admin_notes": "Investigating the issue",
  "updated_at": "2024-03-14T11:00:00.000Z",
  "created_at": "2024-03-14T10:30:00.000Z"
}
```

### 4. Get Messages by Email (Admin Only)

**Request:**
```bash
GET http://localhost:3500/api/v1/admin/contact/email/john@example.com
Authorization: Bearer <admin-token>
x-admin-id: <admin-user-id>
```

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Question about services",
    "status": "resolved",
    "created_at": "2024-03-14T10:30:00.000Z"
  },
  {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Follow-up question",
    "status": "new",
    "created_at": "2024-03-15T14:20:00.000Z"
  }
]
```

---

## Message Status Flow

```
new → in_progress → resolved → closed
```

**Status Descriptions:**
- **new** - Message just received, not yet reviewed
- **in_progress** - Admin is working on the inquiry
- **resolved** - Issue has been addressed (sets `resolved_at` timestamp)
- **closed** - Ticket closed (also sets `resolved_at` timestamp)

---

## Audit Logging

All contact message operations are logged to `audit_logs` table:

**Events Logged:**
- `contact_message_created` - When form is submitted
- `contact_message_updated` - When admin modifies status/notes
- `contact_message_deleted` - When admin deletes message

**Metadata Stored:**
- User ID (for admin actions)
- Status changes
- Admin notes
- Email and subject (for deleted messages)

---

## Security Features

1. **Input Validation**
   - DTOs with class-validator decorators
   - Email format validation (both backend and frontend)
   - String length restrictions
   - SQL injection prevention via parameterized queries

2. **Public vs Protected Routes**
   - POST `/admin/contact` - Public (anyone can submit)
   - All other endpoints - Admin only

3. **Rate Limiting**
   - Can be added via infrastructure service
   - IP-based submission tracking

4. **Data Privacy**
   - IP address and User-Agent captured for security
   - User ID optional (for logged-in users)
   - Email validation with regex pattern

---

## Testing Checklist

### Frontend
- [x] Form validation (client-side)
- [x] Success toast notification
- [x] Error handling
- [x] Form reset after submission
- [x] Dark/light theme support
- [x] Loading state during submission

### Backend
- [x] DTO validation
- [x] Database insert
- [x] Audit log creation
- [x] Error handling (NotFoundException)
- [x] Winston logging

### API Gateway
- [x] Route configuration
- [x] Public route access
- [x] Request forwarding

### Database
- [x] Table creation
- [x] Indexes
- [x] Triggers (updated_at)
- [x] Foreign key constraints

---

## Future Enhancements

1. **Email Notifications**
   - Notify admins when new contact message received
   - Send auto-reply to user confirming receipt
   - Integration with email-service

2. **Admin Dashboard**
   - Create admin panel to view/manage contact messages
   - Add assignment workflow
   - Bulk operations (mark as resolved, delete)

3. **Analytics**
   - Track most common inquiry topics
   - Response time metrics
   - Customer satisfaction follow-up

4. **Spam Protection**
   - reCAPTCHA integration
   - Rate limiting per IP
   - Email validation improvement

5. **Categories**
   - Add category field (Support, Sales, Feedback, etc.)
   - Auto-routing based on category

6. **File Attachments**
   - Allow users to upload screenshots/documents
   - Integrate with file storage service

---

## Environment Variables

### Admin Service
```
PORT=3010
DATABASE_URL=postgresql://user:password@localhost:5432/local_service_marketplace
```

### API Gateway
```
ADMIN_SERVICE_URL=http://localhost:3010
```

### Frontend
```
NEXT_PUBLIC_API_URL=http://localhost:3500
```

---

## Deployment Notes

1. **Database Migration**
   - Run `database/schema.sql` to create `contact_messages` table
   - Ensure `uuid-ossp` extension is enabled

2. **Service Startup Order**
   - PostgreSQL database
   - Admin service (port 3010)
   - API Gateway (port 3500)
   - Frontend (port 3000)

3. **Health Check**
   - Verify admin service: `http://localhost:3010/health`
   - Verify API gateway: `http://localhost:3500/health`

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md)
- [API Specification](./API_SPECIFICATION.md)
- [Microservice Boundary Map](./MICROSERVICE_BOUNDARY_MAP.md)
- [Implementation Guide](./IMPLEMENTATION_GUIDE.md)

---

**Implementation Date:** March 14, 2024  
**Author:** AI Developer  
**Status:** ✅ Complete and Tested
