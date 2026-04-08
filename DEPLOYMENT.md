# Deployment Guide

## Requirements

- Node.js 20+
- npm 10+
- A Gemini API Key (obtain from [Google AI Studio](https://aistudio.google.com/app/apikey))

---

## Quick Start (Single Server, Linux + Nginx + PM2)

### 1. Clone and install dependencies

```bash
git clone <your-repo-url> harness-slide-creator
cd harness-slide-creator
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
GEMINI_API_KEY=your_actual_gemini_api_key
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
DB_FILE=/var/data/slidegen.db
```

### 3. Build the frontend

```bash
npm run build
```

### 4. Start with PM2

```bash
npm install -g pm2

pm2 start npm --name "slidegen" -- start
pm2 save
pm2 startup
```

### 5. Configure Nginx as reverse proxy

Install Nginx, then create `/etc/nginx/sites-available/slidegen`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/slidegen /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 6. Enable HTTPS with Certbot

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

After Certbot runs, update `ALLOWED_ORIGINS` in `.env.local`:

```env
ALLOWED_ORIGINS=https://yourdomain.com
```

Then restart the app:

```bash
pm2 restart slidegen
```

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | **Required.** Google Gemini API key (server-side only) |
| `PORT` | `3000` | Server listening port |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS allowed origins, comma-separated |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in ms (default: 15 min) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window per IP |
| `DB_FILE` | `cloud_storage.db` | SQLite database file path |
| `NODE_ENV` | — | Set to `production` to serve built frontend |

---

## Security Checklist

- [ ] `GEMINI_API_KEY` is **never** committed to git (covered by `.gitignore`)
- [ ] `ALLOWED_ORIGINS` is set to your actual domain (not `*`)
- [ ] HTTPS is enabled in production
- [ ] `DB_FILE` points to a path with restricted filesystem permissions
- [ ] Firewall blocks direct access to port 3000 (only Nginx port 443/80 is public)

---

## npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `tsx server.ts` | Development server with Vite HMR |
| `npm run build` | `vite build` | Build frontend to `dist/` |
| `npm start` | `NODE_ENV=production tsx server.ts` | Production server (serves `dist/`) |
| `npm test` | `vitest` | Run unit and integration tests |
| `npm run test:e2e` | `playwright test` | Run end-to-end tests |
| `npm run lint` | `tsc --noEmit` | TypeScript type check |

---

## Data Persistence

User data is stored in SQLite (`cloud_storage.db` by default). The database is created automatically on first startup.

For production, point `DB_FILE` to a persistent path outside the application directory (e.g., `/var/data/slidegen.db`) so it survives deployments.

---

## Updating the Application

```bash
git pull origin main
npm install
npm run build
pm2 restart slidegen
```
