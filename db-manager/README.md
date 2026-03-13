# Pakkauslista Database Manager

A menu-driven CLI for managing the Firebase Realtime Database. No arguments needed — just run and navigate.

## Setup

```bash
cd db-manager
npm install
```

Optional: Copy `.env.example` to `.env` for custom Firebase config.

## Usage

```bash
node index.js
```

## Navigation

### Main Menu
1. **Users** – Manage users (add, edit, remove)
2. **Browse data** – Navigate the database as a tree, read JSON, export or delete paths
3. **Export to file** – Export full DB or a path to a JSON file
4. **Import from file** – Import JSON file to a path
5. **Remove path** – Delete data at a path
0. **Exit**

### Users
- **Add user**: Enter name, then PIN (or press Enter for a random 4-digit PIN)
- **Edit user**: Select user, change name and/or PIN
- **Remove user**: Select user, confirm

### Browse Data
- Enter a number to go into that key
- **r** – View current path as JSON
- **e** – Export current path to file
- **d** – Delete current path (with confirmation)
- **0** – Back
