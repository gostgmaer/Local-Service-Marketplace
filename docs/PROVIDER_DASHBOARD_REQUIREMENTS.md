# Provider Dashboard Requirements

## Current Status Analysis

### ✅ What Exists:
1. **Public Provider Pages** (`/providers/[id]/*`)
   - Portfolio showcase
   - Document management  
   - Reviews display
   - Basic dashboard

### ❌ What's Missing:

Providers need a **dedicated authenticated dashboard** at `/dashboard` with provider-specific features:

## Required Provider Dashboard Pages:

### 1. `/dashboard/proposals` 
**Purpose**: Manage proposals to service requests
- View open service requests (marketplace)
- Submit proposals with pricing and timeline
- Track proposal status (pending/accepted/rejected)
- Edit or withdraw proposals

### 2. `/dashboard/jobs`
**Purpose**: Manage active and completed jobs
- View accepted jobs
- Update job status/progress
- Mark jobs as complete
- View job history

### 3. `/dashboard/earnings`
**Purpose**: Track income and payouts
- View earnings summary
- Payment history
- Pending payouts
- Revenue analytics

### 4. `/dashboard/schedule`
**Purpose**: Manage availability
- Set working hours
- Block unavailable dates
- Manage booking calendar

### 5. `/dashboard/customers`
**Purpose**: Customer relationship management
- View customer history
- Communication logs
- Repeat customers

## Provider-Specific Features Needed:

### Proposal System:
```typescript
// Feature: Browse and bid on service requests
- Search service requests by category/location
- Filter by budget range and urgency
- Submit competitive proposals
- Auto-calculate fees/commissions
```

### Job Management:
```typescript
// Feature: Track active jobs
- Update job status (in-progress, completed)
- Upload progress photos
- Communicate with customers
- Request milestone payments
```

### Analytics Dashboard:
```typescript
// Provider metrics
- Total earnings
- Jobs completed
- Average rating
- Response time
- Acceptance rate
```

## Implementation Plan:

### Phase 1: Proposal Management
1. Create `/dashboard/browse-requests` - Browse all open requests
2. Create `/dashboard/my-proposals` - Manage submitted proposals
3. Integrate with Proposal Service API

### Phase 2: Job Management  
4. Update `/dashboard/jobs` to show provider's jobs
5. Add job status updates
6. Add completion workflow

### Phase 3: Earnings & Analytics
7. Create `/dashboard/earnings` page
8. Integrate with Payment Service
9. Add analytics widgets

### Phase 4: Schedule Management
10. Create `/dashboard/availability` page
11. Calendar integration
12. Booking management

## Current Architecture Issue:

The existing `/dashboard` pages are **customer-centric**. Providers need:
- **Role-based routing**: Check `user.role` and show appropriate dashboard
- **Conditional navigation**: Different sidebar for providers vs customers
- **Separate page components**: Provider-specific vs customer-specific views

## Recommended Structure:

```
/dashboard
├── page.tsx           # Role-based redirect
├── (customer)/        # Customer-specific routes
│   ├── requests/
│   ├── jobs/
│   └── ...
└── (provider)/        # Provider-specific routes
    ├── browse-requests/
    ├── my-proposals/
    ├── active-jobs/
    ├── earnings/
    └── availability/
```
