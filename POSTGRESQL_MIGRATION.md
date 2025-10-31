# PostgreSQL Migration Guide

## Why PostgreSQL?
- **Free on Render** (PostgreSQL database)
- **Automatic persistence** - no disk configuration needed
- **Better for production** - more reliable than SQLite
- **Automatic backups** included

## Steps to Migrate:

### 1. Create PostgreSQL Database on Render
1. Go to Render Dashboard
2. Click "New" → "PostgreSQL"
3. Choose free plan
4. Note the connection details

### 2. Install PostgreSQL Driver
```bash
npm install pg
```

### 3. Update Environment Variables
Add to Render environment variables:
```
DATABASE_URL=postgresql://username:password@host:port/database
```

### 4. Update server.js
Replace SQLite code with PostgreSQL connection.

## Benefits:
- ✅ Automatic persistence
- ✅ Better performance
- ✅ Production-ready
- ✅ Free on Render
- ✅ Automatic backups