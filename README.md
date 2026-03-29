# GPS Tracker Frontend

## Setup

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # Production build
```

## .env
```
VITE_API_URL=/api  # Uses Vite proxy to backend at :5000
```

## Pages
- `/` Dashboard — live stats + map from API
- `/devices` Device list — from MongoDB via API
- `/devices/add` Add device — saves to MongoDB
- `/devices/:id` Device detail — history + Haversine stats from backend
- `/live` Live tracking — polls `/api/locations/live` every 15s

## API Integration
- All requests go through `src/services/api.js`
- JWT token auto-attached via Axios interceptor
- Auto-redirects to `/login` on 401
- `locationService.getHistoryWithStats()` — backend calculates Haversine distance
- `locationService.calculateRouteDistance()` — multi-waypoint server-side distance
