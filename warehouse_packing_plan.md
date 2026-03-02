# Warehouse Packing Tracker – Full Project Plan

## 1. Project Overview

**Purpose:** Lightweight warehouse packing progress tracker for multi-device local network use. Tracks positions in containers (merikontit) with real-time updates on packed quantities and operator logging.

**Key Features:**
- Multi-container support (identified by container number)
- Add/edit/delete positions
- Real-time tracking of packed quantity
- Transaction log for every operator action
- Display last operator and timestamp on UI
- Simple operator identification (no users/authentication)
- Local server backend with single database

**Target Users:** Warehouse operators using mobile devices or tablets.

**Platform:**
- Frontend: React + Vite + TypeScript
- Backend: Node + Express
- Database: SQLite (single local server) or PostgreSQL if scaling needed

---

## 2. Data Model

### Container
| Field | Type | Notes |
|-------|------|-------|
| id | string (PK) | UUID |
| containerNumber | string | UNIQUE, identifies container (merikontti) |
| createdAt | DateTime | Auto-set |
| isClosed | boolean | Indicates if container is closed |

### Position
| Field | Type | Notes |
|-------|------|-------|
| id | string (PK) | UUID |
| containerId | string (FK) | Linked to Container |
| positionNumber | number | Unique within container |
| name | string | Position nickname |
| totalQuantity | number | Mandatory |
| packedQuantity | number | Auto-updated from transactions |
| weight | number | Optional |
| volume | number | Optional |
| description | string | Optional |
| updatedAt | DateTime | Auto-set on change |

Constraints:
- UNIQUE(containerId, positionNumber)

### PositionTransaction
| Field | Type | Notes |
|-------|------|-------|
| id | string (PK) | UUID |
| positionId | string (FK) | Linked to Position |
| delta | number | Positive or negative amount packed/unpacked |
| operatorName | string | Taken from device localStorage |
| createdAt | DateTime | Timestamp of action |

**Purpose:** Transaction log for audit and real-time last operator display.

---

## 3. Backend Architecture

### Stack
- Node.js
- Express.js
- SQLite (or PostgreSQL)
- REST API endpoints
- Optional WebSocket for real-time updates

### Key REST Endpoints

**Containers:**
```
GET /containers
GET /containers/:id
POST /containers { containerNumber }
PATCH /containers/:id/close
```

**Positions:**
```
GET /containers/:containerId/positions
POST /containers/:containerId/positions
PATCH /positions/:id
DELETE /positions/:id
```

**Transactions:**
```
POST /positions/:id/adjust { delta, operatorName }
GET /positions/:id/transactions
```

### Backend Logic
- Adjustments handled atomically in DB transaction
- Validate delta does not cause packedQuantity < 0 or > totalQuantity
- Update Position.packedQuantity automatically
- Return updated packedQuantity and lastTransaction

### Concurrency Handling
- DB transaction ensures safe updates when multiple devices adjust simultaneously
- Optionally WebSocket for real-time push updates

### Storage
- Single local server storage
- SQLite recommended for simplicity
- Regular backups recommended (nightly dump)

---

## 4. Frontend Architecture

### Stack
- React + Vite + TypeScript
- React Router for navigation
- Context API or Zustand for global state
- LocalStorage for operatorName persistence

### Pages
1. **NameScreen**
   - First screen when operatorName not set
   - Simple input and store in localStorage

2. **ContainerSelectionScreen**
   - List open containers or input new container number
   - Create new container if number not found

3. **ContainerDetailScreen**
   - Show container number
   - List of PositionCards
   - Add Position button

4. **PositionDetailScreen**
   - Large position number and nickname
   - Input for adjustment (+/-)
   - Progress bar
   - Semi-transparent overlay showing last transaction (operatorName, delta, relative time)
   - Additional fields: weight, volume, description

### Components
- **PositionCard**: Shows position summary in container list; color-coded by status (grey=0%, blue=in progress, green=complete)
- **ProgressBar**: Displays packedQuantity / totalQuantity
- **ConfirmModal**: For delete confirmation
- **EmptyState**: Grey + icon when no positions
- **TransactionOverlay**: Semi-transparent info showing last operator and time

### UX Notes
- Auto-focus input field for quick entry
- Enter key = same as pressing +
- Only numeric input for quantity
- Prevent exceeding totalQuantity and going below 0
- Mobile-friendly, large tappable buttons

---

## 5. Operator Flow

1. Open app on mobile/tablet
2. Enter operator name (stored in localStorage)
3. Select or create container (merikontti)
4. View container positions
5. Add/adjust positions as items are packed
6. Progress bar updates with each adjustment
7. Last transaction overlay shows who last modified and when
8. When packedQuantity reaches totalQuantity, PositionCard turns green

---

## 6. Real-Time Updates

- Optional WebSocket server on backend
- Broadcasts position updates and transactions to all connected devices
- Ensures operators see latest packed quantities and last transaction immediately

Fallback: polling every 5-10 seconds if WebSocket is not implemented.

---

## 7. Data Integrity & Backup

- Single local database ensures atomic updates
- Regular backup recommended (manual or scheduled)
- Prevent negative or over-total quantities on backend
- Container locking when closed

---

## 8. Deployment

- Single server in warehouse (LAN)
- Serve frontend static build via Express
- Devices access via browser using server IP
- No authentication needed

---

## 9. Optional Future Enhancements

- Barcode scanning to select positions
- Undo last transaction
- Export reports (PDF/CSV)
- Multiple containers in parallel
- Realtime notifications for completed positions
- Integration with ERP systems

---

## 10. Notes

- Lightweight, simple, production-ready for internal warehouse use
- Operator identification via local device only
- Transaction log provides audit trail and prevents double marking
- Designed for mobile-friendly rapid data entry

---

*End of Plan*

