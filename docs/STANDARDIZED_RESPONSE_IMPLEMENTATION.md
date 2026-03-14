# Standardized API Response Format Implementation

## Overview

All microservices in the Local Service Marketplace platform now return responses in a **standardized format** for consistency, better error handling, and improved developer experience.

## Response Format Specification

### Success Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Resource retrieved successfully",
  "data": {
    // Actual response data
  },
  "total": 10  // Only for array/paginated responses
}
```

### Error Response

```json
{
  "success": false,
  "statusCode": 401,
  "message": "Missing or invalid authorization token",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authorization token",
    "details": { /* only in development mode */ }
  }
}
```

## Rules

1. **Success responses:**
   - ✅ Include `data` field
   - ❌ NO `error` field
   - ✅ Include `total` only for arrays/paginated responses

2. **Error responses:**
   - ✅ Include `error` object with `code` and `message`
   - ❌ NO `data` field

3. **All responses:**
   - ✅ Always include: `success`, `statusCode`, `message`

## Implementation Details

### Microservices

Each microservice now has:

1. **Response Transform Interceptor** (`src/common/interceptors/response-transform.interceptor.ts`)
   - Wraps all successful responses in standardized format
   - Detects and preserves `total` for arrays
   - Handles paginated responses  
   - Avoids double-wrapping already standardized responses

2. **HTTP Exception Filter** (`src/common/filters/http-exception.filter.ts`)
   - Catches all exceptions
   - Returns standardized error format
   - Maps HTTP status codes to error codes

### Services Updated

✅ **All 13 microservices:**
- auth-service
- user-service
- request-service
- proposal-service
- job-service
- payment-service
- notification-service
- messaging-service
- review-service
- admin-service  
- analytics-service
- infrastructure-service
- api-gateway

## Error Codes

| Status Code | Error Code | Description |
|------------|------------|-------------|
| 400 | BAD_REQUEST | Invalid request parameters |
| 401 | UNAUTHORIZED | Missing or invalid authentication |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource conflict |
| 422 | VALIDATION_ERROR | Input validation failed |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests |
| 500 | INTERNAL_ERROR | Internal server error |
| 503 | SERVICE_UNAVAILABLE | Service temporarily unavailable |
| 504 | GATEWAY_TIMEOUT | Gateway timeout |

## Examples

### GET /requests/my (Success with empty array)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Resource retrieved successfully",
  "data": [],
  "total": 0
}
```

### GET /requests/my (Success with data)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Resource retrieved successfully",
  "data": [
    {
      "id": "uuid-1",
      "description": "Need plumbing help",
      "budget": 500,
      "status": "open"
    },
    {
      "id": "uuid-2",
      "description": "Electrical work",
      "budget": 300,
      "status": "in_progress"
    }
  ],
  "total": 2
}
```

### POST /requests (Created)

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Resource created successfully",
  "data": {
    "id": "new-uuid",
    "description": "New request",
    "budget": 600,
    "status": "open",
    "created_at": "2026-03-15T10:00:00Z"
  }
}
```

### GET /requests/:id (Not Found Error)

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Request not found",
  "error": {
    "code": "NOT_FOUND",
    "message": "Request with ID 'xyz' not found"
  }
}
```

### POST /requests (Validation Error)

```json
{
  "success": false,
  "statusCode": 422,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "budget": "Budget must be a positive number",
      "description": "Description is required"
    }
  }
}
```

## Frontend Integration

The frontend API client automatically:
1. Checks for standardized format
2. Unwraps `data` field for successful responses
3. Extracts `error` for error handling
4. Preserves `total` for pagination

```typescript
// Frontend automatically unwraps responses
const requests = await apiClient.get('/requests/my');
// requests = [{ id: '1', ... }, { id: '2', ... }]  // Just the data
```

## Testing

### Test Health Endpoint (Public)
```powershell
Invoke-RestMethod -Uri "http://localhost:3500/health"
```

Expected:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Health retrieved successfully",
  "data": { "status": "ok", ... }
}
```

### Test Protected Endpoint (Without Auth)
```powershell
Invoke-WebRequest -Uri "http://localhost:3500/api/v1/requests/my?user_id=test"
```

Expected:
```json
{
  "success": false,
  "statusCode": 401,  
  "message": "Missing or invalid authorization token",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authorization token"
  }
}
```

## Files Modified

### Each Microservice:
- ✅ `src/main.ts` - Added `ResponseTransformInterceptor`
- ✅ `src/common/interceptors/response-transform.interceptor.ts` - Created
- ✅ `src/common/filters/http-exception.filter.ts` - Updated to standardized error format

### API Gateway:
- ✅ `src/gateway/controllers/gateway.controller.ts` - Updated to pass through standardized responses from microservices

## Benefits

✅ **Consistency** - All endpoints return the same structure  
✅ **Type Safety** - Frontend knows exact response shape  
✅ **Error Handling** - Unified error codes and messages  
✅ **Debugging** - Clear success/failure indication  
✅ **API Documentation** - Easy to document with consistent examples  
✅ **Developer Experience** - Predictable responses across all services  

## Migration Notes

### Before
```json
// Inconsistent formats
[]  // Just array
{ id: "1", name: "test" }  // Just object
{ statusCode: 404, message: "Not found" }  // Old error format
```

### After
```json
// Standardized success
{
  "success": true,
  "statusCode": 200,
  "message": "Resource retrieved successfully",
  "data": [],
  "total": 0
}

// Standardized error
{
  "success": false,
  "statusCode": 404,
  "message": "Resource not found",
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

## Verification

Run the test script to verify implementation:
```powershell
.\test-standardized-format.ps1
```

All 13 microservices + API Gateway now return standardized responses! 🎉
