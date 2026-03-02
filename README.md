# Warehouse Packing Tracker

Lightweight warehouse packing progress tracker for multi-device local network use. Tracks positions in containers (merikontit) with real-time updates on packed quantities and operator logging.

## Quick Start

### Development

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Run backend and frontend concurrently
npm run dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:5173 (proxies API to backend)

### Production

```bash
npm install
cd client && npm install && cd ..
npm run start
```

Serves the app at http://localhost:3001. Access from other devices on your LAN using the server's IP address.

## Features

- **Multi-container support** – Create and select containers by number
- **Add/edit/delete positions** – Position number, name, total quantity
- **Real-time tracking** – Packed quantity with +/- adjustments
- **Transaction log** – Every operator action is logged
- **Last operator overlay** – Shows who last modified and when
- **Operator identification** – Stored in device localStorage (no auth)
- **Mobile-friendly** – Large tappable buttons, touch-optimized

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + Express
- **Database:** SQLite (stored in `data/warehouse.db`)

## Data

Database is created automatically on first run. Backup the `data/` folder for regular backups.
