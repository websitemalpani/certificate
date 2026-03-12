# Certificate Project

This repository contains:
- `server/` Node.js + Express + MySQL backend
- `client/` React + Vite frontend

## 1) Backend setup

1. Copy env template:
`server/config/.env.example` -> `server/config/.env`

2. Install dependencies:
```bash
cd server
npm install
```

3. Start backend:
```bash
npm start
```

4. Health check:
`http://localhost:5000/health`

## 2) Admin seed

Create or update admin user:
```bash
cd server
$env:ADMIN_NAME='Admin'; $env:ADMIN_EMAIL='admin@example.com'; $env:ADMIN_PASSWORD='Admin@123'; $env:ADMIN_MOBILE='9999999999'; npm run seed:admin
```

## 3) Frontend setup

1. Copy env template:
`client/.env.example` -> `client/.env`

2. Install + run:
```bash
cd client
npm install
npm run dev
```

Frontend URL:
`http://localhost:5173`

## 4) CSV upload format

Use headers matching template field names.

Example file:
`client/public/sample-certificates.csv`

## 5) MySQL required tables

Ensure these tables exist:
- `users`
- `certificate_templates`
- `template_fields`
- `upload_batches`
- `certificates`
- `activity_logs`

Use your already executed schema for table creation and constraints.
