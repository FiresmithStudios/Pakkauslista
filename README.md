# Warehouse Packing Tracker

Lightweight warehouse packing progress tracker with **real-time collaboration**. Tracks positions in containers (merikontit) with packed quantities and operator logging. Data stored in Firebase Realtime Database – changes sync instantly across all devices.

## Quick Start

### Development

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173

### Production (Vercel + Firebase)

1. **Create Firebase project**: https://console.firebase.google.com
   - Add a web app → copy the config
   - Enable **Realtime Database** (Build → Realtime Database → Create Database)
   - Copy the database URL (e.g. `https://PROJECT_ID-default-rtdb.firebaseio.com`)

2. **Set database rules** (Realtime Database → Rules):
   ```json
   {
     "rules": {
       "containers": { ".read": true, ".write": true },
       "positions": { ".read": true, ".write": true },
       "position_transactions": { ".read": true, ".write": true }
     }
   }
   ```

3. **Add env vars in Vercel** (optional – config is in `firebase.ts`):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_DATABASE_URL` – **required** if your DB URL differs from default

4. Push to GitHub. Vercel builds and deploys.

## Real-time collaboration

- All data lives in Firebase Realtime Database
- Changes (new containers, position updates, +/- adjustments) sync **instantly** to all connected devices
- No polling – uses Firebase `onValue` listeners
- Multiple operators can work on different containers/positions simultaneously

## Features

- **Multi-container support** – Create and select containers by number
- **Add/edit/delete positions** – Position number, name, total quantity
- **Real-time tracking** – Packed quantity with +/- adjustments, syncs live
- **Transaction log** – Every operator action is logged
- **Last operator overlay** – Shows who last modified and when
- **Operator identification** – Stored in device localStorage (no auth)
- **Mobile-friendly** – Large tappable buttons, touch-optimized

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Database:** Firebase Realtime Database (real-time sync)
- **Deploy:** Vercel (static)
