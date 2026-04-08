import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import crypto from 'crypto';

const TEST_SECRET = 'test-encryption-secret-32-chars!';
const ENC_KEY = crypto.createHash('sha256').update(TEST_SECRET).digest();

function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptApiKey(enc: string): string {
  const [ivHex, encHex] = enc.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function buildApp(db: Database.Database) {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  const getHash = (key: string) => crypto.createHash('sha256').update(key).digest('hex');

  app.get('/api/session', (req, res) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) return res.status(401).json({ error: 'API Key required' });

    const hash = getHash(apiKey);
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const apiKeyEnc = encryptApiKey(apiKey);

    db.prepare(`
      INSERT INTO user_data (user_hash, projects, custom_styles, updated_at, session_token, api_key_enc)
      VALUES (?, '[]', '[]', ?, ?, ?)
      ON CONFLICT(user_hash) DO UPDATE SET
        session_token = excluded.session_token,
        api_key_enc   = excluded.api_key_enc,
        updated_at    = excluded.updated_at
    `).run(hash, Date.now(), sessionToken, apiKeyEnc);

    res.json({ sessionToken, expiresAt });
  });

  const resolveUser = (req: express.Request, res: express.Response): string | null => {
    const sessionToken = req.headers['x-session-token'] as string | undefined;
    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (sessionToken) {
      const row = db.prepare('SELECT user_hash FROM user_data WHERE session_token = ?').get(sessionToken) as any;
      if (row) return row.user_hash;
    }
    if (apiKey) return getHash(apiKey);

    res.status(401).json({ error: 'API Key required' });
    return null;
  };

  app.get('/api/user-data', (req, res) => {
    const hash = resolveUser(req, res);
    if (!hash) return;

    const row = db.prepare('SELECT projects, custom_styles FROM user_data WHERE user_hash = ?').get(hash) as any;
    if (row) {
      res.json({
        projects: JSON.parse(row.projects || '[]'),
        customStyles: JSON.parse(row.custom_styles || '[]'),
      });
    } else {
      res.json({ projects: [], customStyles: [] });
    }
  });

  app.post('/api/user-data', (req, res) => {
    const hash = resolveUser(req, res);
    if (!hash) return;

    const { projects, customStyles } = req.body;
    const now = Date.now();

    db.prepare(`
      INSERT INTO user_data (user_hash, projects, custom_styles, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_hash) DO UPDATE SET
        projects = excluded.projects,
        custom_styles = excluded.custom_styles,
        updated_at = excluded.updated_at
    `).run(hash, JSON.stringify(projects || []), JSON.stringify(customStyles || []), now);

    res.json({ success: true });
  });

  return app;
}

describe('server API routes', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_data (
        user_hash     TEXT PRIMARY KEY,
        projects      TEXT,
        custom_styles TEXT,
        updated_at    INTEGER,
        session_token TEXT,
        api_key_enc   TEXT
      )
    `);
    app = buildApp(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('GET /api/session', () => {
    it('returns 401 when x-api-key header is missing', async () => {
      const res = await request(app).get('/api/session');
      expect(res.status).toBe(401);
    });

    it('returns sessionToken and expiresAt for valid key', async () => {
      const res = await request(app).get('/api/session').set('x-api-key', 'my-api-key');
      expect(res.status).toBe(200);
      expect(res.body.sessionToken).toBeTruthy();
      expect(res.body.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('GET /api/user-data', () => {
    it('returns 401 when no auth header', async () => {
      const res = await request(app).get('/api/user-data');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('API Key required');
    });

    it('returns empty arrays for a new user (x-api-key)', async () => {
      const res = await request(app).get('/api/user-data').set('x-api-key', 'new-user-key');
      expect(res.status).toBe(200);
      expect(res.body.projects).toEqual([]);
      expect(res.body.customStyles).toEqual([]);
    });

    it('returns empty arrays for new user via session token', async () => {
      const sessionRes = await request(app).get('/api/session').set('x-api-key', 'session-user');
      const { sessionToken } = sessionRes.body;

      const res = await request(app).get('/api/user-data').set('x-session-token', sessionToken);
      expect(res.status).toBe(200);
      expect(res.body.projects).toEqual([]);
    });

    it('returns stored data for existing user', async () => {
      const projects = [{ id: 'p1', name: 'Test', createdAt: 1000, slides: [] }];
      await request(app).post('/api/user-data').set('x-api-key', 'existing-user').send({ projects, customStyles: [] });

      const res = await request(app).get('/api/user-data').set('x-api-key', 'existing-user');
      expect(res.status).toBe(200);
      expect(res.body.projects).toHaveLength(1);
      expect(res.body.projects[0].id).toBe('p1');
    });
  });

  describe('POST /api/user-data', () => {
    it('returns 401 when no auth header', async () => {
      const res = await request(app).post('/api/user-data').send({ projects: [], customStyles: [] });
      expect(res.status).toBe(401);
    });

    it('stores projects and customStyles successfully', async () => {
      const projects = [{ id: 'p1', name: 'My Project', createdAt: 1000, slides: [] }];
      const customStyles = [{ id: 'st1', name: 'Dark', style: 'dark', requirements: '', colors: [] }];

      const res = await request(app).post('/api/user-data').set('x-api-key', 'user-key').send({ projects, customStyles });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('updates existing record on conflict (upsert)', async () => {
      const first = [{ id: 'p1', name: 'First', createdAt: 1000, slides: [] }];
      const second = [
        { id: 'p1', name: 'First', createdAt: 1000, slides: [] },
        { id: 'p2', name: 'Second', createdAt: 2000, slides: [] },
      ];

      await request(app).post('/api/user-data').set('x-api-key', 'upsert-user').send({ projects: first, customStyles: [] });
      await request(app).post('/api/user-data').set('x-api-key', 'upsert-user').send({ projects: second, customStyles: [] });

      const res = await request(app).get('/api/user-data').set('x-api-key', 'upsert-user');
      expect(res.body.projects).toHaveLength(2);
    });

    it('data is isolated per user', async () => {
      await request(app).post('/api/user-data').set('x-api-key', 'user-a').send({ projects: [{ id: 'pa1', name: 'A', createdAt: 1, slides: [] }], customStyles: [] });
      await request(app).post('/api/user-data').set('x-api-key', 'user-b').send({ projects: [{ id: 'pb1', name: 'B', createdAt: 1, slides: [] }], customStyles: [] });

      const resA = await request(app).get('/api/user-data').set('x-api-key', 'user-a');
      const resB = await request(app).get('/api/user-data').set('x-api-key', 'user-b');

      expect(resA.body.projects[0].id).toBe('pa1');
      expect(resB.body.projects[0].id).toBe('pb1');
    });
  });
});
