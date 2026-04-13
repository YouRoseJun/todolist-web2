/**
 * AI 总结 — 远程 API 预留入口
 * 在 index.html 中先于 app.js 引入本文件。
 *
 * 对接方式（示例）：
 * 1. 将 TodoAppAiApi.config.endpoint 设为你的后端地址（推荐用自有后端代理，避免把密钥写进前端）。
 * 2. 后端接收 POST JSON，例如：{ "todos": [{ "id","text","completed","createdAt","dueDate" }] }
 * 3. 后端返回 JSON，需包含字段之一：summary | text | message（字符串）
 *
 * 也可直接改 requestSummary 内的 fetch 逻辑以适配你的协议。
 */
(function (global) {
  "use strict";

  /**
   * endpoint 可直接写死，也可在 index.html 里先设置：
   * window.TODO_AI_API_ENDPOINT = "http://localhost:3000/api/ai-summary";
   */
  /** @type {{ endpoint: string }} */
  const config = {
    endpoint:
      (typeof global.TODO_AI_API_ENDPOINT === "string" ? global.TODO_AI_API_ENDPOINT : "").trim() || "",
  };

  /**
   * @param {Array<{ id: string, text: string, completed: boolean, createdAt: number, dueDate: string | null }>} todos
   * @returns {Promise<{ ok: true, text: string, fromApi: boolean } | { ok: false, error: string }>}
   */
  async function requestSummary(todos) {
    const url = (config.endpoint || "").trim();
    if (!url) {
      return { ok: false, error: "NO_ENDPOINT" };
    }
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todos }),
      });
    } catch (e) {
      const msg = e && typeof e.message === "string" ? e.message : "FETCH_FAILED";
      return { ok: false, error: msg };
    }
    if (!res.ok) {
      return { ok: false, error: "HTTP_" + res.status };
    }
    let data;
    try {
      data = await res.json();
    } catch (_) {
      const t = await res.text();
      return { ok: true, text: (t || "").trim() || "（空响应）", fromApi: true };
    }
    const text =
      typeof data.summary === "string"
        ? data.summary
        : typeof data.text === "string"
          ? data.text
          : typeof data.message === "string"
            ? data.message
            : "";
    if (!text) {
      return { ok: false, error: "BAD_RESPONSE" };
    }
    return { ok: true, text, fromApi: true };
  }

  global.TodoAppAiApi = {
    config,
    requestSummary,
  };
})(typeof window !== "undefined" ? window : globalThis);
