# Standardized API Response Structure

## Overview

All API responses from the Local Service Marketplace platform now follow a standardized structure. This ensures consistency across all endpoints and makes it easier for frontend applications to handle responses.

## Response Format

### Success Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Resource retrieved successfully",
  "data": {
    // Your actual response data here
  }
}
```

### Success Response (List)

For list/collection endpoints, the response includes a `total` field:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Resources retrieved successfully",
  "data": [
    // Array of resources
  ],
  "total": 25
}
```

### Error Response

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Resource not found",
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": {
      // Additional error details (only in development)
    }
  }
}
```

## Response Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | Yes | Indicates if the request was successful |
| `statusCode` | number | Yes | HTTP status code (200, 201, 400, 404, etc.) |
| `message` | string | Yes | Human-readable message describing the result |
| `data` | any | No | The actual response payload (present on success) |
| `total` | number | No | Total count for list responses |
| `error` | object | No | Error details (present on failure) |
| `error.code` | string | No | Error code (e.g., "NOT_FOUND", "UNAUTHORIZED") |
| `error.message` | string | No | Error message |
| `error.details` | any | No | Additional error information (development only) |

## HTTP Status Codes

### Success Codes
- **200 OK**: Request successful (GET, PATCH, DELETE)
- **201 Created**: Resource created successfully (POST)
- **204 No Content**: Request successful with no response body

### Client Error Codes
- **400 Bad Request**: Invalid request format or parameters
- **401 Unauthorized**: Authentication required or invalid token
- **403 Forbidden**: User doesn't have permission
- **404 Not Found**: Resource doesn't exist
- **409 Conflict**: Resource already exists or state conflict
- **422 Unprocessable Entity**: Validation error
- **429 Too Many Requests**: Rate limit exceeded

### Server Error Codes
- **500 Internal Server Error**: Unexpected server error
- **502 Bad Gateway**: Upstream service error
- **503 Service Unavailable**: Service temporarily unavailable

## Error Codes

| Code | Description |
|------|-------------|
| `BAD_REQUEST` | Invalid request format |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Access denied |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Resource conflict |
| `VALIDATION_ERROR` | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Server error |
| `SERVICE_UNAVAILABLE` | Service temporarily down |

## Message Generation

Messages are automatically generated based on the HTTP method and status code:

- **POST (201)**: `{Resource} created successfully`
- **GET**: `{Resource} retrieved successfully`
- **PATCH/PUT**: `{Resource} updated successfully`
- **DELETE**: `{Resource} deleted successfully`

## Examples

### POST /api/v1/requests (Create Request)

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Request created successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "789e4567-e89b-12d3-a456-426614174000",
    "description": "Need plumbing service",
    "category_id": "456e4567-e89b-12d3-a456-426614174000",
    "budget": 200,
    "status": "open",
    "created_at": "2026-03-14T07:30:00.000Z"
  }
}
```

### GET /api/v1/requests/my (Get My Requests)

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "My retrieved successfully",
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "description": "Need plumbing service",
      "status": "open",
      "created_at": "2026-03-14T07:30:00.000Z"
    }
  ],
  "total": 1
}
```

### PATCH /api/v1/requests/:id (Update Request)

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Id updated successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "in_progress",
    "updated_at": "2026-03-14T08:00:00.000Z"
  }
}
```

### DELETE /api/v1/requests/:id (Delete Request)

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Id deleted successfully"
}
```

Note: DELETE responses typically don't include `data` field.

### Error Example: 404 Not Found

**Response:**
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Request not found",
  "error": {
    "code": "NOT_FOUND",
    "message": "Request not found"
  }
}
```

### Error Example: 422 Validation Error

**Response:**
```json
{
  "success": false,
  "statusCode": 422,
  "message": "description should not be empty, budget must be a positive number",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "description should not be empty, budget must be a positive number",
    "details": {
      "message": [
        "description should not be empty",
        "budget must be a positive number"
      ]
    }
  }
}
```

## Frontend Usage

The frontend API client automatically unwraps the standardized response:

```typescript
// Old way (still works for backward compatibility)
const response = await apiClient.get('/requests');
const requests = response.data; // Now automatically unwrapped

// With total count for lists
const response = await apiClient.get('/requests/my?user_id=123');
const { data, total } = response.data;
console.log(`Found ${total} requests`);

// Error handling
try {
  await apiClient.post('/requests', requestData);
} catch (error) {
  // Error toast is automatically shown
  // Error response follows standard format
  console.error(error.response.data.error.code); // "VALIDATION_ERROR"
}
```

## Implementation Details

### Backend (API Gateway)

The standardization is implemented via:

1. **Response Transform Interceptor** (`response-transform.interceptor.ts`)
   - Automatically wraps all responses in the standard format
   - Detects paginated responses and adds `total` field
   - Generates appropriate messages based on HTTP method

2. **Exception Filter** (`http-exception.filter.ts`)
   - Catches all exceptions
   - Formats errors in the standard structure
   - Maps HTTP status codes to error codes
   - Logs errors for debugging

### Frontend (API Client)

The frontend handles the standardized responses via:

1. **Response Interceptor** (in `api-client.ts`)
   - Automatically unwraps the `data` field from responses
   - Preserves `total` field for list responses
   - Handles error responses consistently

2. **Error Handling**
   - Extracts error messages from the standard error structure
   - Shows appropriate toast notifications
   - Provides detailed error information for debugging

## Migration Guide

### For Existing Endpoints

No changes required! The interceptor automatically wraps existing responses.

### For New Endpoints

Simply return your data as usual:

```typescript
// Controller
@Get()
async getRequests() {
  return this.requestService.getRequests(); // Returns array or object
}

// Result is automatically wrapped:
// {
//   "success": true,
//   "statusCode": 200,
//   "message": "Requests retrieved successfully",
//   "data": [...] // Your data here
// }
```

## Benefits

1. ✅ **Consistency**: All APIs follow the same structure
2. ✅ **Predictability**: Frontend knows exactly what to expect
3. ✅ **Error Handling**: Standardized error format makes error handling easier
4. ✅ **Debugging**: Clear success/failure indicators and error codes
5. ✅ **Documentation**: Self-documenting with descriptive messages
6. ✅ **Type Safety**: TypeScript interfaces ensure type safety
7. ✅ **Backward Compatible**: Existing code continues to work

## Notes

- The `message` field is auto-generated but can be overridden if needed
- The `total` field is automatically added for array responses
- Error `details` are only included in development environment for security
- All responses are logged for monitoring and debugging
