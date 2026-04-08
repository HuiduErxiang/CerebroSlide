import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { GoogleGenAI, GenerateContentConfig } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = process.env.DB_FILE ?? "cloud_storage.db";
const db = new Database(dbFile);

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

try { db.exec(`ALTER TABLE user_data ADD COLUMN session_token TEXT`); } catch {}
try { db.exec(`ALTER TABLE user_data ADD COLUMN api_key_enc TEXT`); } catch {}

const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET ?? "slidegen-dev-secret-change-in-prod";
const ENC_KEY = crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();

function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptApiKey(enc: string): string {
  const [ivHex, encHex] = enc.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENC_KEY, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT ?? "3000", 10);

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map(o => o.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    })
  );

  const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? "100", 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });

  app.use("/api/", apiLimiter);
  app.use(express.json({ limit: "50mb" }));

  const getHash = (key: string) => crypto.createHash("sha256").update(key).digest("hex");

  app.get("/api/session", (req, res) => {
    const apiKey = req.headers["x-api-key"] as string;
    if (!apiKey) return res.status(401).json({ error: "API Key required" });

    const hash = getHash(apiKey);
    const sessionToken = crypto.randomBytes(32).toString("hex");
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
    const sessionToken = req.headers["x-session-token"] as string | undefined;
    const apiKey = req.headers["x-api-key"] as string | undefined;

    if (sessionToken) {
      const row = db
        .prepare("SELECT user_hash FROM user_data WHERE session_token = ?")
        .get(sessionToken) as { user_hash: string } | undefined;
      if (row) return row.user_hash;
    }

    if (apiKey) return getHash(apiKey);

    res.status(401).json({ error: "API Key required" });
    return null;
  };

  const resolveApiKey = (req: express.Request): string | null => {
    const sessionToken = req.headers["x-session-token"] as string | undefined;
    const apiKey = req.headers["x-api-key"] as string | undefined;

    if (sessionToken) {
      const row = db
        .prepare("SELECT api_key_enc FROM user_data WHERE session_token = ?")
        .get(sessionToken) as { api_key_enc: string | null } | undefined;
      if (row?.api_key_enc) {
        try { return decryptApiKey(row.api_key_enc); } catch { return null; }
      }
    }

    if (apiKey) return apiKey;
    return null;
  };

  app.get("/api/user-data", (req, res) => {
    const hash = resolveUser(req, res);
    if (!hash) return;

    const row = db
      .prepare("SELECT projects, custom_styles FROM user_data WHERE user_hash = ?")
      .get(hash) as { projects: string; custom_styles: string } | undefined;

    if (row) {
      res.json({
        projects: JSON.parse(row.projects || "[]"),
        customStyles: JSON.parse(row.custom_styles || "[]"),
      });
    } else {
      res.json({ projects: [], customStyles: [] });
    }
  });

  app.post("/api/user-data", (req, res) => {
    const hash = resolveUser(req, res);
    if (!hash) return;

    const { projects, customStyles } = req.body;
    const now = Date.now();

    db.prepare(`
      INSERT INTO user_data (user_hash, projects, custom_styles, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_hash) DO UPDATE SET
        projects      = excluded.projects,
        custom_styles = excluded.custom_styles,
        updated_at    = excluded.updated_at
    `).run(hash, JSON.stringify(projects || []), JSON.stringify(customStyles || []), now);

    res.json({ success: true });
  });

  app.post("/api/ai/generate-content", async (req, res) => {
    const geminiKey = resolveApiKey(req);
    if (!geminiKey) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const { model, contents, config } = req.body;

      const ai = new GoogleGenAI({ apiKey: geminiKey });

      const sdkConfig: GenerateContentConfig = {};
      if (config) {
        const c = config as Record<string, unknown>;
        if (c.systemInstruction) sdkConfig.systemInstruction = c.systemInstruction as string;
        if (c.responseMimeType) sdkConfig.responseMimeType = c.responseMimeType as string;
        if (c.responseSchema) sdkConfig.responseSchema = c.responseSchema;
        if (c.temperature !== undefined) sdkConfig.temperature = c.temperature as number;
        if (c.maxOutputTokens !== undefined) sdkConfig.maxOutputTokens = c.maxOutputTokens as number;
        if (c.thinkingConfig) sdkConfig.thinkingConfig = c.thinkingConfig as GenerateContentConfig['thinkingConfig'];
        if (c.responseModalities) sdkConfig.responseModalities = c.responseModalities as string[];
        if (c.imageConfig) sdkConfig.imageConfig = c.imageConfig as GenerateContentConfig['imageConfig'];
      }

      const modelName = (model as string) ?? "gemini-3.1-flash-lite-preview";
      const result = await ai.models.generateContent({
        model: modelName,
        contents,
        config: Object.keys(sdkConfig).length > 0 ? sdkConfig : undefined,
      });

      const responseData = {
        candidates: JSON.parse(JSON.stringify(result.candidates)),
        finishReason: result.candidates?.[0]?.finishReason ?? null,
      };
      res.json(responseData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
