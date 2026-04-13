import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();

const PORT = Number(process.env.PORT || 3000);
const AI_BASE_URL = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const AI_API_KEY = process.env.AI_API_KEY || "";
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server or same-origin tools with no Origin header.
      if (!origin) return callback(null, true);
      if (!CORS_ORIGINS.length || CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("CORS_BLOCKED"));
    },
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/ai-summary", async (req, res) => {
  try {
    const todos = Array.isArray(req.body?.todos) ? req.body.todos : [];
    if (!todos.length) {
      return res.json({ summary: "当前暂无待办事项，可先添加任务再生成总结。" });
    }
    if (!AI_API_KEY) {
      return res.status(500).json({ message: "AI_API_KEY_MISSING" });
    }

    const prompt = buildPrompt(todos);
    const text = await requestChatCompletion(prompt);
    if (!text) {
      return res.status(502).json({ message: "EMPTY_MODEL_RESPONSE" });
    }
    return res.json({ summary: text.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "SERVER_ERROR";
    return res.status(500).json({ message });
  }
});

async function requestChatCompletion(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const resp = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "你是效率助手。请用简洁中文总结待办清单，输出 4-8 行，包含：总体进展、优先事项、逾期提醒、今日行动建议。",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    const data = await safeJson(resp);
    if (!resp.ok) {
      throw new Error(`UPSTREAM_HTTP_${resp.status}:${JSON.stringify(data)}`);
    }

    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" ? text : "";
  } finally {
    clearTimeout(timeout);
  }
}

function buildPrompt(todos) {
  const normalized = todos.map((t, i) => ({
    idx: i + 1,
    text: String(t?.text || ""),
    completed: Boolean(t?.completed),
    dueDate: t?.dueDate || null,
    createdAt: t?.createdAt || null,
  }));

  return JSON.stringify(
    {
      now: new Date().toISOString(),
      todos: normalized,
      requirement: "请基于以上 JSON 做中文任务总结，突出优先级与下一步行动。",
    },
    null,
    2
  );
}

async function safeJson(resp) {
  try {
    return await resp.json();
  } catch {
    return {};
  }
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`AI backend running at http://localhost:${PORT}`);
});
