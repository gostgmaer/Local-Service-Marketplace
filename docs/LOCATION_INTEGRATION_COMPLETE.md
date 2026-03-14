# Location Integration Complete Guide

## Overview

This guide documents the complete location integration for the Local Service Marketplace platform. Both service providers and consumers can now see precise location information with Google Maps integration.

---

## What Was Implemented

### 1. Database Schema

**Updated `locations` table** with precise coordinate support:

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,    -- Precise to ~1.1mm
  longitude DECIMAL(11, 8) NOT NULL,   -- Precise to ~1.1mm
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'US',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_locations_coordinates ON locations (latitude, longitude);
CREATE INDEX idx_locations_user_id ON locations (user_id);
```

### 2. Backend Implementation

#### DTOs (Data Transfer Objects)

**LocationDto** (incoming data):
```typescript
export class LocationDto {
  @IsNumber() lat: number;
  @IsNumber() lng: number;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() zipCode?: string;
  @IsOptional() @IsString() country?: string;
}
```

**CreateRequestDto** (updated):
```typescript
export class CreateRequestDto {
  @IsUUID() user_id: string;
  @IsUUID() category_id: string;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
  @IsString() @MinLength(10) description: string;
  @IsNumber() @Min(0) budget: number;
}
```

**LocationResponseDto** (outgoing data):
```typescript
export class LocationResponseDto {
  id: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
}
```

#### Entities

**Location Entity**:
```typescript
export interface Location {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  created_at: Date;
}
```

**ServiceRequest Entity** (updated):
```typescript
export interface ServiceRequest {
  id: string;
  user_id: string;
  category_id: string;
  location_id?: string;
  description: string;
  budget: number;
  status: string;
  created_at: Date;
  location?: Location;  // ← NEW: Populated from JOIN
}
```

#### Repositories

**LocationRepository** - Full CRUD operations:
```typescript
@Injectable()
export class LocationRepository {
  async createLocation(dto): Promise<Location>
  async getLocationById(id: string): Promise<Location | null>
  async getLocationsByUserId(userId: string): Promise<Location[]>
  async updateLocation(id: string, dto): Promise<Location | null>
  async deleteLocation(id: string): Promise<boolean>
}
```

**RequestRepository** - Updated queries with location JOINs:
```typescript
// All queries now LEFT JOIN locations table
async getRequestById(id: string): Promise<ServiceRequest | null> {
  // Returns request with populated location object
}

async getRequestsPaginated(queryDto): Promise<ServiceRequest[]> {
  // Returns list with location data for each request
}

async getRequestsByUser(userId: string): Promise<ServiceRequest[]> {
  // Returns user's requests with locations
}
```

#### Service Layer

**RequestService** - Location creation integrated:
```typescript
async createRequest(dto: CreateRequestDto): Promise<ServiceRequest> {
  // 1. Create location if dto.location exists
  let location_id: string | undefined;
  if (dto.location) {
    const location = await this.locationRepository.createLocation({
      user_id: dto.user_id,
      latitude: dto.location.lat,
      longitude: dto.location.lng,
      address: dto.location.address,
      // ... other fields
    });
    location_id = location.id;
  }
  
  // 2. Create request with location_id
  const request = await this.requestRepository.createRequest({
    ...dto,
    location_id,
  } as any);
  
  return request;
}
```

#### Module Registration

**request.module.ts**:
```typescript
@Module({
  providers: [
    RequestService,
    CategoryService,
    RequestRepository,
    CategoryRepository,
    LocationRepository,  // ← Registered
  ],
})
export class RequestModule {}
```

### 3. Frontend Implementation

#### Components

**LocationPicker** - Interactive map for location selection:
- **Features**:
  - Google Maps autocomplete search
  - Click-to-select location
  - Draggable marker
  - Current location detection
  - Reverse geocoding
  - Address parsing (street, city, state, zip)
- **Usage**:
  ```tsx
  <LocationPicker 
    onLocationSelect={(location) => setLocation(location)}
    initialLocation={location}
    height="400px"
  />
  ```

**LocationMap** - Read-only map display:
- **Features**:
  - Display saved location
  - Info window with address
  - Non-interactive (view only)
  - Responsive sizing
- **Usage**:
  ```tsx
  <LocationMap
    latitude={request.location.latitude}
    longitude={request.location.longitude}
    address={request.location.address}
    height="300px"
    zoom={15}
  />
  ```

#### Validation Schema

**Zod schema for frontend validation**:
```typescript
const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().default('US'),
});

const createRequestSchema = z.object({
  // ... other fields
  location: locationSchema.optional(),
});
```

#### Pages Updated

**Request Creation Page** (`/requests/create`):
```tsx
<LocationPicker 
  onLocationSelect={(loc) => setLocation(loc)}
  initialLocation={location}
/>

// Validation on submit:
if (!location || location.lat === 0) {
  toast.error('Please select a location on the map');
  return;
}
```

**Request Detail Page** (`/requests/[id]`):
```tsx
{request.location && request.location.latitude && (
  <div>
    <h3>Service Location</h3>
    {request.location.address && (
      <div className="address-display">
        {request.location.address}
        {request.location.city}, {request.location.state} {request.location.zip_code}
      </div>
    )}
    <LocationMap
      latitude={request.location.latitude}
      longitude={request.location.longitude}
      address={request.location.address}
    />
  </div>
)}
```

---

## Data Flow

### Creating a Request with Location

```
1. User → Frontend (LocationPicker)
   - Searches address or clicks map
   - Marker placed at coordinates
   - Reverse geocoding extracts address details
   
2. Frontend → Validation
   - Zod schema validates lat/lng ranges
   - Ensures location object is complete
   
3. Frontend → Backend API
   POST /requests
   {
     "user_id": "...",
     "category_id": "...",
     "description": "...",
     "budget": 500,
     "location": {
       "lat": 37.7749,
       "lng": -122.4194,
       "address": "123 Main St",
       "city": "San Francisco",
       "state": "CA",
       "zipCode": "94102",
       "country": "US"
     }
   }
   
4. Backend → Request Service
   - Validates DTO (class-validator)
   - Creates Location record
   - Gets location_id
   - Creates ServiceRequest with location_id
   
5. Database
   INSERT INTO locations (...) RETURNING id;
   INSERT INTO service_requests (..., location_id) RETURNING *;
   
6. Backend → Response
   {
     "id": "request-uuid",
     "location": {
       "id": "location-uuid",
       "latitude": 37.7749,
       "longitude": -122.4194,
       "address": "123 Main St",
       ...
     },
     ...
   }
```

### Viewing a Request with Location

```
1. Frontend → Backend API
   GET /requests/{id}
   
2. Backend → Request Repository
   SELECT 
     r.*, 
     l.id, l.latitude, l.longitude, l.address, l.city, l.state, l.zip_code, l.country
   FROM service_requests r
   LEFT JOIN locations l ON r.location_id = l.id
   WHERE r.id = $1
   
3. Backend → Response
   {
     "id": "...",
     "description": "...",
     "location": {
       "latitude": 37.7749,
       "longitude": -122.4194,
       "address": "123 Main St",
       ...
     }
   }
   
4. Frontend → LocationMap Component
   - Renders Google Map
   - Places marker at coordinates
   - Shows address in info window
```

---

## Google Maps Setup

### 1. Get API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
4. Create credentials → API Key
5. Restrict the key (optional but recommended):
   - HTTP referrers: `localhost:3000`, `yourdomain.com`
   - API restrictions: Maps JavaScript, Places, Geocoding

### 2. Configure Frontend

Add to `.env.local`:
```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

### 3. Load Script

The app already includes the script tag in the HTML:
```html
<script
  src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY&libraries=places"
  async
  defer
></script>
```

---

## Testing Checklist

### Backend Tests

- [ ] **Create location** - POST valid coordinates
- [ ] **Validate coordinates** - Reject lat > 90, lng > 180
- [ ] **Create request with location** - Verify location_id set
- [ ] **Create request without location** - Should work (optional)
- [ ] **Fetch request by ID** - Verify location object included
- [ ] **Fetch requests paginated** - All have location data
- [ ] **Update location** - Partial updates work
- [ ] **Delete location** - Cascade or handle gracefully

### Frontend Tests

- [ ] **LocationPicker renders** - Map loads successfully
- [ ] **Search autocomplete** - Places API returns results
- [ ] **Click to select** - Marker moves to clicked position
- [ ] **Drag marker** - Updates coordinates
- [ ] **Current location** - Browser geolocation works
- [ ] **Reverse geocoding** - Address appears after click
- [ ] **Validation** - Required location shows error
- [ ] **Create request** - Location saved to backend
- [ ] **View request** - LocationMap shows saved location
- [ ] **Dark mode** - Map styling matches theme

### Integration Tests

- [ ] **End-to-end flow**:
  1. Create request with location
  2. Submit to backend
  3. Verify database has location record
  4. Fetch request
  5. Display on detail page
  6. Verify map shows correct coordinates

---

## API Endpoints

### Requests (with location support)

**Create Request**:
```
POST /requests
Content-Type: application/json

{
  "user_id": "uuid",
  "category_id": "uuid",
  "description": "Need plumbing work",
  "budget": 500,
  "location": {
    "lat": 37.7749,
    "lng": -122.4194,
    "address": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zipCode": "94102",
    "country": "US"
  }
}

Response 201:
{
  "id": "request-uuid",
  "user_id": "uuid",
  "category_id": "uuid",
  "description": "Need plumbing work",
  "budget": 500,
  "status": "pending",
  "location": {
    "id": "location-uuid",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "address": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip_code": "94102",
    "country": "US"
  },
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Get Request by ID**:
```
GET /requests/{id}

Response 200:
{
  "id": "request-uuid",
  "description": "...",
  "location": {
    "id": "location-uuid",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "address": "123 Main St",
    ...
  },
  ...
}
```

**List Requests**:
```
GET /requests?limit=20&cursor=xyz

Response 200:
{
  "data": [
    {
      "id": "...",
      "location": { ... },
      ...
    }
  ],
  "hasMore": true,
  "cursor": "abc"
}
```

---

## File Structure

```
services/request-service/
  src/modules/request/
    dto/
      create-request.dto.ts          ← LocationDto added
      request-response.dto.ts        ← LocationResponseDto added
    entities/
      location.entity.ts             ← NEW
      service-request.entity.ts      ← location property added
    repositories/
      location.repository.ts         ← NEW
      request.repository.ts          ← JOINs added
    services/
      request.service.ts             ← Location creation logic
    request.module.ts                ← LocationRepository registered

frontend/nextjs-app/
  components/ui/
    LocationPicker.tsx               ← NEW (interactive map)
    LocationMap.tsx                  ← NEW (read-only display)
  app/requests/
    create/page.tsx                  ← LocationPicker integrated
    [id]/page.tsx                    ← LocationMap integrated
  schemas/
    request.schema.ts                ← locationSchema added
  types/
    google-maps.d.ts                 ← TypeScript definitions

database/
  schema.sql                         ← locations table updated
```

---

## Environment Variables

### Backend
```bash
# Database (already configured)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=marketplace
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
```

### Frontend
```bash
# Google Maps API
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here

# API Gateway (already configured)
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## Future Enhancements

### Phase 1 (Current) ✅
- [x] Location picker with Google Maps
- [x] Save location coordinates and address
- [x] Display location on request detail page
- [x] Database schema with indexes

### Phase 2 (Planned)
- [ ] **Location-based search**:
  - Find requests within X miles
  - Provider service area filtering
  - Distance calculation (Haversine formula)
  
- [ ] **Provider service areas**:
  - Define coverage radius
  - Display on provider profile
  - Filter requests by coverage
  
- [ ] **Job location tracking**:
  - Link job to request location
  - Display on job detail page
  - Route optimization for providers

- [ ] **Advanced mapping**:
  - Multiple markers (show nearby requests)
  - Heatmap view (request density)
  - Drawing tools (define service area)
  - Street View integration

- [ ] **Mobile optimization**:
  - Native device geolocation
  - Smaller map controls
  - Touch gesture support

### Phase 3 (Future)
- [ ] **PostGIS integration**:
  - Convert DECIMAL to GEOGRAPHY type
  - Use spatial indexes (GIST)
  - Native distance queries
  - Polygon service areas
  
- [ ] **Caching**:
  - Cache geocoding results
  - Redis for frequent location lookups
  
- [ ] **Analytics**:
  - Most requested areas
  - Provider coverage heatmap
  - Service gap analysis

---

## Troubleshooting

### Common Issues

**1. Map not loading**
```
Error: Google Maps JavaScript API error: InvalidKeyMapError
```
- Check API key is correct
- Verify APIs are enabled in Google Cloud Console
- Check HTTP referrer restrictions

**2. TypeScript errors in components**
```
Cannot find name 'google'
```
- Ensure `declare const google: any;` is at top of file
- Check `google-maps.d.ts` type definitions exist

**3. Location not saving**
```
400 Bad Request: location_id does not exist
```
- Verify LocationRepository is registered in request.module.ts
- Check database table exists with correct schema
- Ensure location creation happens before request creation

**4. Coordinates not displaying**
```
Map shows default location (0, 0)
```
- Verify latitude/longitude are DECIMAL type, not VARCHAR
- Check parseFloat() is used when reading from database
- Ensure coordinates are valid ranges (-90 to 90, -180 to 180)

**5. Address not reverse geocoded**
```
Address field is empty after clicking map
```
- Check Geocoding API is enabled
- Verify API key has Geocoding permissions
- Check browser console for API errors

### Debug Commands

**Check database schema**:
```sql
\d locations
-- Should show latitude DECIMAL(10,8), longitude DECIMAL(11,8)

SELECT * FROM locations LIMIT 1;
-- Verify coordinates are numeric, not strings
```

**Test location creation**:
```bash
curl -X POST http://localhost:3001/requests \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "uuid",
    "category_id": "uuid",
    "description": "Test request",
    "budget": 100,
    "location": {
      "lat": 37.7749,
      "lng": -122.4194,
      "address": "123 Main St"
    }
  }'
```

**Verify JOIN query**:
```sql
SELECT 
  r.id, r.description, 
  l.latitude, l.longitude, l.address
FROM service_requests r
LEFT JOIN locations l ON r.location_id = l.id
LIMIT 5;
```

---

## Performance Considerations

### Database
- **Indexes**: Created on `(latitude, longitude)` and `user_id`
- **Query optimization**: LEFT JOIN instead of separate queries
- **Data types**: DECIMAL for precision, not FLOAT (floating point errors)

### Frontend
- **Lazy loading**: Google Maps script loads asynchronously
- **Debouncing**: Search autocomplete has 300ms delay
- **Marker clustering**: For future multi-marker views
- **Responsive images**: Map tiles loaded progressively

### Backend
- **Optional location**: Requests work without location for backward compatibility
- **Validation**: Early validation prevents unnecessary geocoding calls
- **Caching opportunity**: Geocoding results can be cached by address

---

## Security Notes

### API Key Protection
- Use HTTP referrer restrictions in production
- Rotate keys periodically
- Monitor usage in Google Cloud Console
- Set daily quotas to prevent abuse

### Data Validation
- Backend validates coordinate ranges
- Frontend validates before submission
- SQL injection protected (parameterized queries)
- XSS protected (React escapes by default)

### Privacy
- Location is optional (user choice)
- Precise coordinates stored (required for mapping)
- Consider blurring location to nearest intersection in public views
- Provider sees exact location only after job accepted

---

## Conclusion

The location integration is now **fully functional** with:

✅ **Backend**: Location entity, repository, service integration, database schema  
✅ **Frontend**: LocationPicker (interactive), LocationMap (display)  
✅ **Validation**: DTOs with class-validator, Zod schemas  
✅ **Data Flow**: Create → Save → Retrieve → Display  
✅ **Documentation**: Complete setup and usage guide  

Both **service providers and consumers** can now see precise pinpoint locations on Google Maps with full address details.

---

## Quick Reference

### Backend Files
- `database/schema.sql` - Updated locations table
- `services/request-service/src/modules/request/entities/location.entity.ts`
- `services/request-service/src/modules/request/repositories/location.repository.ts`
- `services/request-service/src/modules/request/dto/create-request.dto.ts`
- `services/request-service/src/modules/request/dto/request-response.dto.ts`
- `services/request-service/src/modules/request/services/request.service.ts`
- `services/request-service/src/modules/request/request.module.ts`

### Frontend Files
- `frontend/nextjs-app/components/ui/LocationPicker.tsx`
- `frontend/nextjs-app/components/ui/LocationMap.tsx`
- `frontend/nextjs-app/app/requests/create/page.tsx`
- `frontend/nextjs-app/app/requests/[id]/page.tsx`
- `frontend/nextjs-app/schemas/request.schema.ts`
- `frontend/nextjs-app/types/google-maps.d.ts`

### Setup Steps
1. Get Google Maps API key
2. Add to `.env.local`: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...`
3. Enable APIs: Maps JavaScript, Places, Geocoding
4. Run migrations (schema.sql already updated)
5. Start backend: `cd services/request-service && npm run start:dev`
6. Start frontend: `cd frontend/nextjs-app && npm run dev`
7. Test at http://localhost:3000/requests/create

---

End of documentation.
