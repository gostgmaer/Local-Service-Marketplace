# Provider Dashboard Implementation Plan

**Project:** Local Service Marketplace - Provider Dashboard  
**Date:** March 15, 2026  
**Status:** Frontend Complete, Backend Partial  
**Estimated Completion:** 7-9 hours of backend work

---

## Project Overview

This plan outlines the complete implementation roadmap for the provider dashboard feature, including both completed frontend work and remaining backend tasks.

---

## ✅ Phase 1: Frontend Implementation (COMPLETED)

### 1.1 Dashboard Core Components

**Files Created:**
- ✅ `frontend/components/dashboard/CustomerDashboard.tsx`
- ✅ `frontend/components/dashboard/ProviderDashboard.tsx`
- ✅ `frontend/app/dashboard/page.tsx` (role-based routing)

**Features:**
- Role detection and conditional rendering
- Provider stats dashboard (proposals, jobs, earnings, success rate)
- Customer stats dashboard (requests, jobs, notifications)
- Quick action buttons for providers

### 1.2 Browse Requests Page

**File:** ✅ `frontend/app/dashboard/browse-requests/page.tsx`

**Features:**
- Search by description, location, category
- Filter by status and category
- Real-time API integration with request-service
- Displays budget, location, proposal count
- View details navigation

**API Integration:** ✅ Complete (`GET /requests`)

### 1.3 My Proposals Page

**File:** ✅ `frontend/app/dashboard/my-proposals/page.tsx`

**Features:**
- Status overview cards (Pending, Accepted, Rejected, Withdrawn)
- Filter by proposal status
- Withdraw pending proposals
- View associated requests
- Navigate to jobs from accepted proposals

**API Integration:** ✅ Complete (`GET /proposals/my`, `PATCH /proposals/:id`)

### 1.4 Availability Schedule Page

**File:** ✅ `frontend/app/dashboard/availability/page.tsx`

**Features:**
- Quick schedule templates (Weekdays, Weekends, Full Week)
- Add/remove time slots
- Visual weekly calendar preview
- Time validation
- Save/cancel changes

**API Integration:** ✅ Complete (`GET /providers`, `PATCH /providers/:id/availability`)

### 1.5 Earnings Dashboard Page

**File:** ✅ `frontend/app/dashboard/earnings/page.tsx`

**Features:**
- Total earnings calculation (from job data)
- Monthly earnings display
- Average per job calculation
- Transaction history table
- Warning banner for missing backend API

**API Integration:** ⚠️ Partial (using job-service workaround, needs payment-service endpoints)

### 1.6 Configuration Updates

**Files Modified:**
- ✅ `frontend/config/constants.ts` - Added provider routes
  - `DASHBOARD_BROWSE_REQUESTS: '/dashboard/browse-requests'`
  - `DASHBOARD_MY_PROPOSALS: '/dashboard/my-proposals'`
  - `DASHBOARD_EARNINGS: '/dashboard/earnings'`
  - `DASHBOARD_AVAILABILITY: '/dashboard/availability'`

---

## ⏳ Phase 2: Backend Implementation (PENDING)

### 2.1 Payment Service - Earnings Endpoints

**Priority:** HIGH  
**Estimated Time:** 4-6 hours  
**Service:** payment-service

#### Task 2.1.1: Create Provider Earnings Controller Methods

**File:** `services/payment-service/src/payment/controllers/payment.controller.ts`

```typescript
@Get('provider/:providerId/earnings')
@HttpCode(HttpStatus.OK)
async getProviderEarnings(
  @Param('providerId', ParseUUIDPipe) providerId: string,
  @Query('start_date') startDate?: string,
  @Query('end_date') endDate?: string,
): Promise<ProviderEarningsResponseDto> {
  return this.paymentService.getProviderEarnings(
    providerId,
    startDate ? new Date(startDate) : undefined,
    endDate ? new Date(endDate) : undefined,
  );
}

@Get('provider/:providerId/transactions')
@HttpCode(HttpStatus.OK)
async getProviderTransactions(
  @Param('providerId', ParseUUIDPipe) providerId: string,
  @Query() queryDto: TransactionQueryDto,
): Promise<PaginatedTransactionResponseDto> {
  return this.paymentService.getProviderTransactions(providerId, queryDto);
}

@Get('provider/:providerId/payouts')
@HttpCode(HttpStatus.OK)
async getProviderPayouts(
  @Param('providerId', ParseUUIDPipe) providerId: string,
): Promise<PayoutResponseDto[]> {
  return this.paymentService.getProviderPayouts(providerId);
}
```

**Acceptance Criteria:**
- [ ] All three endpoints added to controller
- [ ] UUID validation on providerId parameter
- [ ] Optional date filtering on earnings endpoint
- [ ] Pagination support on transactions endpoint
- [ ] Proper HTTP status codes

#### Task 2.1.2: Create DTOs

**File:** `services/payment-service/src/payment/dto/provider-earnings-response.dto.ts`

```typescript
export class ProviderEarningsResponseDto {
  summary: {
    total_earnings: number;
    total_paid: number;
    pending_payout: number;
    completed_count: number;
    currency: string;
  };
  monthly: Array<{
    month: string;
    earnings: number;
    job_count: number;
  }>;
  average_per_job: number;
}

export class TransactionQueryDto {
  limit?: number = 20;
  cursor?: string;
  status?: string;
}

export class PaginatedTransactionResponseDto {
  data: TransactionDto[];
  total: number;
  cursor?: string;
}

export class TransactionDto {
  id: string;
  job_id: string;
  customer_id: string;
  provider_amount: number;
  platform_fee: number;
  total_amount: number;
  status: string;
  payment_method: string;
  transaction_id: string;
  created_at: Date;
  paid_at?: Date;
  customer_name: string;
}

export class PayoutResponseDto {
  id: string;
  amount: number;
  status: string;
  payout_method: string;
  payout_date: Date;
  transaction_count: number;
}
```

**Acceptance Criteria:**
- [ ] All DTOs created with proper validation decorators
- [ ] Optional fields marked correctly
- [ ] Default values set where appropriate

#### Task 2.1.3: Implement Service Layer

**File:** `services/payment-service/src/payment/services/payment.service.ts`

```typescript
async getProviderEarnings(
  providerId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<ProviderEarningsResponseDto> {
  // Get earnings summary from repository
  const summary = await this.paymentRepository.getProviderEarnings(
    providerId,
    startDate,
    endDate,
  );

  // Get monthly breakdown
  const monthly = await this.paymentRepository.getProviderEarningsByMonth(
    providerId,
    startDate,
    endDate,
  );

  // Calculate average
  const avgPerJob = summary.completed_count > 0
    ? summary.total_earnings / summary.completed_count
    : 0;

  return {
    summary,
    monthly,
    average_per_job: avgPerJob,
  };
}

async getProviderTransactions(
  providerId: string,
  queryDto: TransactionQueryDto,
): Promise<PaginatedTransactionResponseDto> {
  return this.paymentRepository.getProviderTransactions(
    providerId,
    queryDto.limit,
    queryDto.cursor,
    queryDto.status,
  );
}

async getProviderPayouts(
  providerId: string,
): Promise<PayoutResponseDto[]> {
  return this.paymentRepository.getProviderPayouts(providerId);
}
```

**Acceptance Criteria:**
- [ ] Business logic correctly calculates earnings
- [ ] Date filtering applied correctly
- [ ] Handles edge cases (no payments, division by zero)
- [ ] Error handling for invalid provider IDs

#### Task 2.1.4: Extend Repository

**File:** `services/payment-service/src/payment/repositories/payment.repository.ts`

```typescript
async getProviderEarnings(
  providerId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<any> {
  const query = `
    SELECT 
      COALESCE(SUM(provider_amount), 0) as total_earnings,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN provider_amount ELSE 0 END), 0) as total_paid,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN provider_amount ELSE 0 END), 0) as pending_payout,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
      currency
    FROM payments
    WHERE provider_id = $1
      AND created_at >= COALESCE($2, '2020-01-01')
      AND created_at <= COALESCE($3, NOW())
    GROUP BY currency
  `;
  const result = await this.pool.query(query, [providerId, startDate, endDate]);
  return result.rows[0] || { total_earnings: 0, total_paid: 0, pending_payout: 0, completed_count: 0, currency: 'USD' };
}

async getProviderEarningsByMonth(
  providerId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<any[]> {
  const query = `
    SELECT 
      TO_CHAR(created_at, 'YYYY-MM') as month,
      SUM(provider_amount) as earnings,
      COUNT(*) as job_count
    FROM payments
    WHERE provider_id = $1
      AND status = 'completed'
      AND created_at >= COALESCE($2, '2020-01-01')
      AND created_at <= COALESCE($3, NOW())
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month DESC
    LIMIT 12
  `;
  const result = await this.pool.query(query, [providerId, startDate, endDate]);
  return result.rows;
}

async getProviderTransactions(
  providerId: string,
  limit: number = 20,
  cursor?: string,
  status?: string,
): Promise<any> {
  let query = `
    SELECT 
      p.*,
      u.name as customer_name
    FROM payments p
    LEFT JOIN users u ON p.customer_id = u.id
    WHERE p.provider_id = $1
  `;
  
  const params: any[] = [providerId];
  let paramIndex = 2;

  if (status) {
    query += ` AND p.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (cursor) {
    query += ` AND p.created_at < $${paramIndex}`;
    params.push(cursor);
    paramIndex++;
  }

  query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex}`;
  params.push(limit);

  const result = await this.pool.query(query, params);
  
  const nextCursor = result.rows.length === limit
    ? result.rows[result.rows.length - 1].created_at
    : null;

  return {
    data: result.rows,
    total: result.rowCount,
    cursor: nextCursor,
  };
}

async getProviderPayouts(providerId: string): Promise<any[]> {
  // Note: This assumes a payouts table exists or will be created
  // For MVP, can return empty array
  return [];
}
```

**Acceptance Criteria:**
- [ ] Query returns correct earnings summary
- [ ] Monthly breakdown groups correctly
- [ ] Transactions paginated with cursor
- [ ] Joins customer data for transaction history
- [ ] Handles missing data gracefully

#### Task 2.1.5: Add Database Indexes

**File:** `database/migrations/008_add_provider_earnings_indexes.sql`

```sql
-- Optimize provider earnings queries
CREATE INDEX IF NOT EXISTS idx_payments_provider_created 
ON payments(provider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_provider_status 
ON payments(provider_id, status);

CREATE INDEX IF NOT EXISTS idx_payments_status 
ON payments(status);

-- Analyze table for query optimization
ANALYZE payments;
```

**Acceptance Criteria:**
- [ ] Indexes created successfully
- [ ] Query performance improved (test with EXPLAIN)
- [ ] No duplicate indexes

---

### 2.2 API Gateway Routing

**Priority:** MEDIUM  
**Estimated Time:** 30 minutes  
**Service:** api-gateway

#### Task 2.2.1: Add Payment Provider Routes

**File:** `api-gateway/src/routes/payment.routes.ts`

```typescript
// Add to existing payment routes
router.get(
  '/provider/:providerId/earnings',
  authMiddleware,
  roleMiddleware(['provider', 'admin']),
  async (req, res, next) => {
    try {
      const response = await axios.get(
        `${PAYMENT_SERVICE_URL}/provider/${req.params.providerId}/earnings`,
        {
          params: req.query,
          headers: { ...req.headers },
        }
      );
      res.json(response.data);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/provider/:providerId/transactions',
  authMiddleware,
  roleMiddleware(['provider', 'admin']),
  async (req, res, next) => {
    try {
      const response = await axios.get(
        `${PAYMENT_SERVICE_URL}/provider/${req.params.providerId}/transactions`,
        {
          params: req.query,
          headers: { ...req.headers },
        }
      );
      res.json(response.data);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/provider/:providerId/payouts',
  authMiddleware,
  roleMiddleware(['provider', 'admin']),
  async (req, res, next) => {
    try {
      const response = await axios.get(
        `${PAYMENT_SERVICE_URL}/provider/${req.params.providerId}/payouts`,
        {
          headers: { ...req.headers },
        }
      );
      res.json(response.data);
    } catch (error) {
      next(error);
    }
  }
);
```

**Acceptance Criteria:**
- [ ] Routes added to API gateway
- [ ] Authentication middleware applied
- [ ] Role-based access control (provider + admin only)
- [ ] Proper error handling
- [ ] Request/response logged

---

### 2.3 Frontend Service Integration

**Priority:** MEDIUM  
**Estimated Time:** 1 hour  
**Service:** frontend

#### Task 2.3.1: Create Payment Service

**File:** `frontend/services/payment-service.ts`

```typescript
import { apiClient } from './api-client';

export interface ProviderEarnings {
  summary: {
    total_earnings: number;
    total_paid: number;
    pending_payout: number;
    completed_count: number;
    currency: string;
  };
  monthly: Array<{
    month: string;
    earnings: number;
    job_count: number;
  }>;
  average_per_job: number;
}

export interface Transaction {
  id: string;
  job_id: string;
  customer_id: string;
  provider_amount: number;
  platform_fee: number;
  total_amount: number;
  status: string;
  payment_method: string;
  transaction_id: string;
  created_at: string;
  paid_at?: string;
  customer_name: string;
}

export interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  cursor?: string;
}

class PaymentService {
  async getProviderEarnings(
    startDate?: Date,
    endDate?: Date
  ): Promise<ProviderEarnings> {
    const params: any = {};
    if (startDate) params.start_date = startDate.toISOString();
    if (endDate) params.end_date = endDate.toISOString();

    const authState = JSON.parse(localStorage.getItem('auth-storage') || '{}');
    const userId = authState?.state?.user?.id;

    const response = await apiClient.get<ProviderEarnings>(
      `/payments/provider/${userId}/earnings`,
      { params }
    );
    return response.data;
  }

  async getProviderTransactions(
    limit: number = 20,
    cursor?: string,
    status?: string
  ): Promise<PaginatedTransactions> {
    const authState = JSON.parse(localStorage.getItem('auth-storage') || '{}');
    const userId = authState?.state?.user?.id;

    const params: any = { limit };
    if (cursor) params.cursor = cursor;
    if (status) params.status = status;

    const response = await apiClient.get<PaginatedTransactions>(
      `/payments/provider/${userId}/transactions`,
      { params }
    );
    return response.data;
  }

  async getProviderPayouts(): Promise<any[]> {
    const authState = JSON.parse(localStorage.getItem('auth-storage') || '{}');
    const userId = authState?.state?.user?.id;

    const response = await apiClient.get<any[]>(
      `/payments/provider/${userId}/payouts`
    );
    return response.data;
  }
}

export const paymentService = new PaymentService();
```

**Acceptance Criteria:**
- [ ] Service file created
- [ ] TypeScript interfaces match backend DTOs
- [ ] Uses existing apiClient
- [ ] Gets user ID from auth state
- [ ] Proper error handling

#### Task 2.3.2: Update Earnings Page

**File:** `frontend/app/dashboard/earnings/page.tsx`

Replace workaround code with real API:

```typescript
// REMOVE WORKAROUND:
// const { data: jobs, isLoading } = useQuery({
//   queryKey: ['provider-jobs'],
//   queryFn: () => jobService.getMyJobs(),
// });

// ADD REAL API:
const { data: earnings, isLoading } = useQuery({
  queryKey: ['provider-earnings'],
  queryFn: () => paymentService.getProviderEarnings(),
  enabled: isAuthenticated && user?.role === 'provider',
});

const { data: transactions, isLoading: transactionsLoading } = useQuery({
  queryKey: ['provider-transactions'],
  queryFn: () => paymentService.getProviderTransactions(50),
  enabled: isAuthenticated && user?.role === 'provider',
});

// Remove warning banner
// Update stats to use earnings.summary
// Update table to use transactions.data
```

**Acceptance Criteria:**
- [ ] Uses paymentService instead of jobService
- [ ] Warning banner removed
- [ ] Real earnings data displayed
- [ ] Transaction history from payment service
- [ ] Export button enabled

---

## ⏳ Phase 3: Testing & Validation (PENDING)

### 3.1 Backend Unit Tests

**Estimated Time:** 2 hours

#### Task 3.1.1: Payment Service Tests

**File:** `services/payment-service/src/payment/services/payment.service.spec.ts`

**Test Cases:**
- [ ] getProviderEarnings returns correct summary
- [ ] Monthly breakdown grouped correctly
- [ ] Average calculation handles division by zero
- [ ] Date filtering works correctly
- [ ] Handles provider with no payments
- [ ] Currency handling

#### Task 3.1.2: Repository Tests

**File:** `services/payment-service/src/payment/repositories/payment.repository.spec.ts`

**Test Cases:**
- [ ] Query returns correct data structure
- [ ] Pagination works with cursor
- [ ] Status filter applied correctly
- [ ] Joins customer data properly

### 3.2 Integration Tests

**Estimated Time:** 1 hour

**Test Cases:**
- [ ] End-to-end flow: Frontend → Gateway → Service → Database
- [ ] Authentication required
- [ ] Role-based access control enforced
- [ ] Provider can only see their own data
- [ ] Pagination works across services

### 3.3 Performance Tests

**Estimated Time:** 1 hour

**Test Cases:**
- [ ] Query performance with 10k+ payments
- [ ] Response time < 500ms for earnings
- [ ] Pagination handles large datasets
- [ ] Indexes used correctly (EXPLAIN ANALYZE)

---

## 📋 Implementation Checklist

### Backend (Payment Service)
- [ ] Create controller methods (3 endpoints)
- [ ] Create DTOs (4 files)
- [ ] Implement service layer (3 methods)
- [ ] Extend repository (3 methods)
- [ ] Add database indexes
- [ ] Write unit tests
- [ ] Write integration tests

### API Gateway
- [ ] Add earnings route
- [ ] Add transactions route
- [ ] Add payouts route
- [ ] Test routing
- [ ] Update documentation

### Frontend
- [ ] Create payment-service.ts
- [ ] Update earnings page
- [ ] Remove workaround code
- [ ] Remove warning banner
- [ ] Enable export button
- [ ] Test integration

### Documentation
- [x] Backend implementation report
- [x] Implementation plan (this file)
- [ ] Update API_SPECIFICATION.md
- [ ] Update FRONTEND_API_INTEGRATION.md

### Deployment
- [ ] Run database migration
- [ ] Deploy payment-service
- [ ] Deploy api-gateway
- [ ] Deploy frontend
- [ ] Smoke test production
- [ ] Monitor errors

---

## Timeline Estimate

| Task | Estimated Time | Depends On |
|------|----------------|------------|
| Payment Service Controller | 1 hour | - |
| Payment Service DTOs | 30 minutes | - |
| Payment Service Logic | 2 hours | Controller, DTOs |
| Payment Repository Updates | 1.5 hours | DTOs |
| Database Migration | 15 minutes | - |
| API Gateway Routes | 30 minutes | Payment Service |
| Frontend Service | 30 minutes | API Gateway |
| Frontend Integration | 30 minutes | Frontend Service |
| Unit Tests | 2 hours | Service, Repository |
| Integration Tests | 1 hour | All Backend |
| Documentation | 1 hour | - |

**Total Estimated Time: 10-11 hours**

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Database performance issues | Low | Medium | Add indexes, test with large dataset |
| Complex date filtering logic | Low | Low | Use PostgreSQL date functions |
| Currency conversion needed | Medium | High | Start with single currency (USD) |
| Payout system not defined | High | Medium | Return empty array for MVP |
| Frontend breaking changes | Low | High | Maintain backward compatibility |

---

## Success Criteria

### Definition of Done

- [ ] All 3 earnings endpoints return correct data
- [ ] Frontend displays real payment data
- [ ] No warning banners on earnings page
- [ ] All tests passing
- [ ] Performance acceptable (< 500ms)
- [ ] Documentation updated
- [ ] Code reviewed and merged
- [ ] Deployed to staging
- [ ] User acceptance testing passed

### Key Metrics

- **API Response Time:** < 500ms for earnings
- **Database Query Performance:** < 200ms
- **Frontend Load Time:** < 2 seconds
- **Test Coverage:** > 80%
- **Zero Critical Bugs:** Before production deployment

---

## Rollback Plan

If issues arise during deployment:

1. **Frontend:** Revert to workaround code (already in place)
2. **Backend:** Remove new endpoints, redeploy previous version
3. **Database:** Indexes are non-breaking, can remain
4. **Gateway:** Remove new routes, redeploy

**Rollback Time:** < 15 minutes

---

## Future Enhancements (Post-MVP)

### Phase 4: Analytics & Reporting
- Earnings trend charts
- Monthly comparison graphs
- Category performance breakdown
- Best time periods analysis

### Phase 5: Payout Management
- Bank account integration
- Automated payout scheduling
- Payout history tracking
- Tax documentation generation

### Phase 6: Advanced Features
- Multi-currency support
- Real-time earnings notifications
- Invoice generation
- Expense tracking
- Profit margin analysis

---

## Appendix: API Endpoints Summary

### Request Service ✅
```
GET /requests?status={}&category_id={}&limit={}
```

### Proposal Service ✅
```
GET /proposals/my?user_id={}
PATCH /proposals/{id}
```

### Provider Service ✅
```
GET /providers?user_id={}
PATCH /providers/{id}/availability
```

### Payment Service ⏳
```
GET /payments/provider/:id/earnings        [PENDING]
GET /payments/provider/:id/transactions    [PENDING]
GET /payments/provider/:id/payouts         [PENDING]
```

---

**Plan Version:** 1.0  
**Last Updated:** March 15, 2026  
**Status:** Ready for Implementation
