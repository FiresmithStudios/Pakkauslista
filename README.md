# Warehouse Packing Tracker

Lightweight warehouse packing progress tracker. Tracks positions in containers (merikontit) with packed quantities and operator logging. Data stored in the cloud (Vercel Blob).

## Quick Start

### Development

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Local dev uses localStorage (no API). Deploy to Vercel for cloud storage.

### Production (Vercel)

1. Push to GitHub and connect the repo to Vercel.

2. In Vercel project → Storage → Create Database → **Blob** (free tier).

3. Deploy. Vercel auto-adds `BLOB_READ_WRITE_TOKEN`.

Data is stored in a single JSON file in Vercel Blob. All devices share the same data.

## Features

- **Multi-container support** – Create and select containers by number
- **Add/edit/delete positions** – Position number, name, total quantity
- **Real-time tracking** – Packed quantity with +/- adjustments
- **Transaction log** – Every operator action is logged
- **Last operator overlay** – Shows who last modified and when
- **Operator identification** – Stored in device localStorage (no auth)
- **Mobile-friendly** – Large tappable buttons, touch-optimized
- **Cloud storage** – JSON file in Vercel Blob, shared across devices

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Storage:** Vercel Blob (single JSON file)
- **Deploy:** Vercel (static + serverless API)
