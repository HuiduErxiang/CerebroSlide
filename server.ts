import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("cloud_storage.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS user_data (
    user_hash TEXT PRIMARY KEY,
    projects TEXT,
    custom_styles TEXT,
    updated_at INTEGER
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Helper to hash API Key
  const getHash = (key: string) => crypto.createHash('sha256').update(key).digest('hex');

  // API Routes
  app.get("/api/user-data", (req, res) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) return res.status(401).json({ error: "API Key required" });

    const hash = getHash(apiKey);
    const row = db.prepare("SELECT projects, custom_styles FROM user_data WHERE user_hash = ?").get(hash) as any;

    if (row) {
      res.json({
        projects: JSON.parse(row.projects || "[]"),
        customStyles: JSON.parse(row.custom_styles || "[]")
      });
    } else {
      res.json({ projects: [], customStyles: [] });
    }
  });

  app.post("/api/user-data", (req, res) => {
    const apiKey = req.headers['x-api-key'] as string;
    const { projects, customStyles } = req.body;

    if (!apiKey) return res.status(401).json({ error: "API Key required" });

    const hash = getHash(apiKey);
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
