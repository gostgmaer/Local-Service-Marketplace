# Google Maps Integration Setup Guide

## Quick Start

### 1. Get Google Maps API Key

1. Visit [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing one
3. Enable these APIs:
   - **Maps JavaScript API**
   - **Places API**
   - **Geocoding API**

4. Go to **Credentials** → **Create Credentials** → **API Key**

### 2. Configure API Key Restrictions (Recommended)

**Application Restrictions:**
- Type: **HTTP referrers (websites)**
- Website restrictions:
  ```
  http://localhost:3000/*
  https://yourdomain.com/*
  ```

**API Restrictions:**
- Restrict key to these APIs:
  - Maps JavaScript API
  - Places API
  - Geocoding API

### 3. Add to Environment Variables

Create `.env.local` in `frontend/nextjs-app/`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyYourActualApiKeyHere123456789
```

### 4. Test the Integration

Start the development server:
```bash
cd frontend/nextjs-app
npm run dev
```

Visit: `http://localhost:3000/requests/create`

You should see:
- ✅ Interactive map loads
- ✅ Search autocomplete works
- ✅ Click on map sets location
- ✅ Current location button works

---

## Component Usage

### LocationPicker (Interactive)

```tsx
import { LocationPicker } from '@/components/ui/LocationPicker';

const [location, setLocation] = useState(null);

<LocationPicker
  value={location}
  onChange={setLocation}
  label="Service Location"
  required
/>
```

**Features:**
- Address search with autocomplete
- Click map to select location
- Drag marker to adjust
- Current location detection
- Reverse geocoding (coordinates → address)

### LocationMap (Display Only)

```tsx
import { LocationMap } from '@/components/ui/LocationPicker';

<LocationMap
  location={{
    lat: 37.7749,
    lng: -122.4194,
    address: "San Francisco, CA"
  }}
  height="h-64"
  showMarker={true}
/>
```

**Use Cases:**
- Show job location
- Display provider service area
- View request location

---

## API Pricing (as of 2024)

Google Maps offers **$200 free credit** per month.

**Typical Usage:**
- Map Load: $7 per 1000 loads
- Autocomplete: $2.83 per 1000 requests
- Geocoding: $5 per 1000 requests

**Free Monthly Quota** (~28,500 map loads)

For small to medium applications, this is likely sufficient within free tier.

---

## Troubleshooting

### Map Not Loading

**Check:**
1. API key is in `.env.local`
2. APIs are enabled in Google Cloud Console
3. No console errors (F12 → Console tab)
4. API key restrictions allow your domain

### Search Not Working

**Check:**
1. Places API is enabled
2. Wait 2-3 minutes after enabling API
3. Check browser console for errors

### "This page can't load Google Maps correctly"

**Issue:** API key missing or invalid

**Fix:**
1. Verify `.env.local` has correct key
2. Restart dev server after adding env var
3. Check API key in Google Cloud Console

### Rate Limiting

**Issue:** Too many requests

**Fix:**
1. Add API rate limiting in code
2. Cache geocoding results
3. Upgrade Google Cloud billing plan

---

## Production Deployment

### Vercel

Add environment variable:
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_production_key
```

Update API restrictions:
```
https://yourdomain.com/*
https://*.vercel.app/*
```

### Docker

Update `docker-compose.yml`:
```yaml
environment:
  - NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}
```

Add to `.env`:
```
GOOGLE_MAPS_API_KEY=your_production_key
```

---

## Advanced Features (Future)

### Radius Search
```tsx
// Find providers within 10 miles of location
const providers = await searchProviders({
  lat: 37.7749,
  lng: -122.4194,
  radius: 10, // miles
});
```

### Distance Calculation
```tsx
import { getDistance } from '@/utils/maps';

const distance = getDistance(
  { lat: 37.7749, lng: -122.4194 }, // Point A
  { lat: 37.7849, lng: -122.4294 }  // Point B
);
// Returns distance in miles
```

### Multiple Markers
```tsx
// Show all nearby providers on map
<LocationMap
  location={userLocation}
  markers={providers.map(p => ({
    lat: p.location.lat,
    lng: p.location.lng,
    label: p.name,
  }))}
/>
```

---

## Security Best Practices

1. ✅ **Never commit API keys** to git
2. ✅ **Use environment variables** for sensitive data
3. ✅ **Restrict API keys** by domain and API
4. ✅ **Monitor usage** in Google Cloud Console
5. ✅ **Set up billing alerts**
6. ✅ **Use separate keys** for dev/prod

---

## Cost Optimization

1. **Lazy Load Maps** - Only load when needed
2. **Cache Results** - Store geocoded addresses
3. **Batch Requests** - Combine multiple geocoding requests
4. **Use Static Maps** - For non-interactive displays
5. **Implement Debouncing** - On search autocomplete

---

## Support & Resources

- [Google Maps JavaScript API Docs](https://developers.google.com/maps/documentation/javascript)
- [Places API Docs](https://developers.google.com/maps/documentation/places/web-service)
- [Geocoding API Docs](https://developers.google.com/maps/documentation/geocoding)
- [Pricing Calculator](https://mapsplatformtransition.withgoogle.com/calculator)

---

## Summary

✅ Google Maps fully integrated  
✅ LocationPicker component ready  
✅ Request creation form enhanced  
✅ Environment variables configured  
✅ Production deployment ready  

**Next Steps:**
1. Get API key from Google Cloud
2. Add to `.env.local`
3. Restart dev server
4. Test on `/requests/create`
