const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Key sirf environment variable me rahegi, kabhi code me nahi.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const APP_KEY = process.env.APP_KEY || ""; // apna secret password, app me wahi daalna hai

// Simple rate limit: har IP se 20 message / 10 minute
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 600000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 20;
}

const SYSTEM =
  "You are a helpful AI assistant like ChatGPT. Reply in the same language the user writes in (Hinglish, Hindi or English). Be clear and concise.";

app.get("/", (_, res) => res.send("Backend chal raha hai"));

app.post("/chat", async (req, res) => {
  try {
    if (APP_KEY && req.get("x-app-key") !== APP_KEY)
      return res.status(401).json({ error: "Galat app key" });
    if (limited(req.ip))
      return res.status(429).json({ error: "Bahut zyada messages, thodi der baad try karein." });

    const msgs = (req.body.messages || [])
      .slice(-20)
      .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }));
    if (!msgs.length || msgs[msgs.length - 1].role !== "user")
      return res.status(400).json({ error: "Message nahi mila" });

    const r = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 1000,
      system: SYSTEM,
      messages: msgs
    });
    res.json({ text: r.content.filter(b => b.type === "text").map(b => b.text).join("\n") });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server me kuch galat hua." });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Chal raha hai"));
