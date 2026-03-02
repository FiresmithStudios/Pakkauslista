# Warehouse Packing Tracker

Lightweight warehouse packing progress tracker. Tracks positions in containers (merikontit) with packed quantities and operator logging. Data stored in Supabase Storage (cloud).

## Quick Start

### Development

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Local dev uses localStorage when Supabase is not configured.

### Production (Vercel + Supabase)

1. **Create Supabase project** (free): https://supabase.com
   - New project → note the **Project URL** and **anon public** key (Settings → API).

2. **Create storage bucket:**
   - Storage → New bucket → name: `warehouse`
   - Make it **public** (or add policy: allow anon for insert/update/select).

3. **Add env vars in Vercel** (Settings → Environment Variables):
   - `VITE_SUPABASE_URL` – your Project URL
   - `VITE_SUPABASE_ANON_KEY` – your anon public key

4. Push to GitHub. Vercel builds and deploys.

Data is stored in a single JSON file in Supabase Storage. All devices share the same data. No serverless API = no ESM issues.

## Features

- **Multi-container support** – Create and select containers by number
- **Add/edit/delete positions** – Position number, name, total quantity
- **Real-time tracking** – Packed quantity with +/- adjustments
- **Transaction log** – Every operator action is logged
- **Last operator overlay** – Shows who last modified and when
- **Operator identification** – Stored in device localStorage (no auth)
- **Mobile-friendly** – Large tappable buttons, touch-optimized
- **Cloud storage** – JSON file in Supabase Storage, shared across devices

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Storage:** Supabase Storage (single JSON file, client-only)
- **Deploy:** Vercel (static only)
