import http from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "../../");
const webRoot = path.join(appRoot, "apps/web");

const port = process.env.PORT || 3000;
const openAiKey = process.env.OPENAI_API_KEY;

const prompts = {
  full_scene: `Analyze this scene for someone with low vision.
Use CLOCK POSITIONS:
- 12 o'clock = straight ahead
- 3 o'clock = right
- 9 o'clock = left
Provide:
1. Main objects with clock position + distance in feet
2. Any hazards (stairs, obstacles) - mark URGENT
3. Overall context (room type, indoor/outdoor)
Format: "Object at [position], [distance] [direction]. CAUTION: [hazard]."
Be concise, prioritize safety.`,
};

const sendJson = (res, status, payload) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

const readJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
};

const serveStatic = (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = requestUrl.pathname;
  if (pathname === "/") {
    pathname = "/index.html";
  }
  const filePath = path.join(webRoot, pathname);
  if (!filePath.startsWith(webRoot)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }
    const ext = path.extname(filePath);
    const contentType =
      ext === ".css"
        ? "text/css"
        : ext === ".js"
          ? "text/javascript"
          : "text/html";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
};

const handleTranscribe = async (req, res) => {
  const body = await readJsonBody(req);
  const { audioBase64 } = body;
  if (!audioBase64) {
    return sendJson(res, 400, { error: "audioBase64 is required" });
  }
  if (!openAiKey) {
    return sendJson(res, 200, { text: "(mock) What do you see?", confidence: 0.5 });
  }

  const form = new FormData();
  const audioBuffer = Buffer.from(audioBase64, "base64");
  form.set("file", new Blob([audioBuffer], { type: "audio/webm" }), "audio.webm");
  form.set("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return sendJson(res, response.status, { error: errorText });
  }

  const data = await response.json();
  return sendJson(res, 200, { text: data.text, confidence: 1.0 });
};

const handleAnalyze = async (req, res) => {
  const body = await readJsonBody(req);
  const { imageBase64, queryType = "full_scene" } = body;
  if (!imageBase64) {
    return sendJson(res, 400, { error: "imageBase64 is required" });
  }
  if (!openAiKey) {
    return sendJson(res, 200, {
      description: "(mock) Desk at 12 o'clock, 4 feet ahead. CAUTION: none.",
    });
  }

  const prompt = prompts[queryType] || prompts.full_scene;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return sendJson(res, response.status, { error: errorText });
  }

  const data = await response.json();
  const description = data.choices?.[0]?.message?.content || "";
  return sendJson(res, 200, { description });
};

const handleTts = async (req, res) => {
  const body = await readJsonBody(req);
  const { text, urgency = "normal" } = body;
  if (!text) {
    return sendJson(res, 400, { error: "text is required" });
  }
  if (!openAiKey) {
    return sendJson(res, 200, { audioBase64: "", note: "mock" });
  }

  const voice = urgency === "urgent" ? "nova" : "alloy";
  const speed = urgency === "urgent" ? 1.1 : 1.0;
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice,
      speed,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return sendJson(res, response.status, { error: errorText });
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return sendJson(res, 200, { audioBase64: buffer.toString("base64") });
};

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    try {
      if (req.url === "/api/health" && req.method === "GET") {
        return sendJson(res, 200, { ok: true });
      }
      if (req.url === "/api/transcribe" && req.method === "POST") {
        return handleTranscribe(req, res);
      }
      if (req.url === "/api/analyze" && req.method === "POST") {
        return handleAnalyze(req, res);
      }
      if (req.url === "/api/tts" && req.method === "POST") {
        return handleTts(req, res);
      }
      return sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      return sendJson(res, 500, { error: error.message || "Server error" });
    }
  }

  return serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`VisionAI Nexus server running on http://localhost:${port}`);
});
