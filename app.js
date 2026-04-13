(function () {
  "use strict";

  const STORAGE_KEY = "todolist-v1";

  /** @typedef {{ id: string, text: string, completed: boolean, createdAt: number, dueDate: string | null }} Todo */

  /** @type {Todo[]} */
  let todos = [];
  /** @type {'all' | 'active' | 'completed'} */
  let filter = "all";

  const $form = document.getElementById("form-add");
  const $input = document.getElementById("input-todo");
  /** 单框日历控件，值为 YYYY-MM-DD */
  const $due = document.getElementById("input-due");
  const $dueWrap = document.getElementById("label-due-wrap");
  const $list = document.getElementById("list");
  const $footer = document.getElementById("footer-stats");
  const $clearDone = document.getElementById("btn-clear-done");
  const $filters = document.querySelectorAll(".filter");
  const $btnAi = document.getElementById("btn-ai-summary");
  const $aiOut = document.getElementById("ai-summary-output");

  function snapshotTodosForApi() {
    return todos.map((t) => ({
      id: t.id,
      text: t.text,
      completed: t.completed,
      createdAt: t.createdAt,
      dueDate: t.dueDate,
    }));
  }

  function buildLocalTodoSummary(list) {
    if (!list.length) return "当前暂无待办。添加任务后，可再次点击「生成总结」。";
    const active = list.filter((t) => !t.completed);
    const done = list.filter((t) => t.completed);
    const overdue = active.filter((t) => t.dueDate && dueDayStatus(t) === "overdue");
    const lines = [
      "【本地预览】未配置远程 API 时的摘要：",
      "共 " + list.length + " 条：未完成 " + active.length + "，已完成 " + done.length + "。",
    ];
    if (overdue.length) lines.push("其中 " + overdue.length + " 条已逾期，建议优先处理。");
    const preview = active.slice(0, 5).map((t, i) => i + 1 + ". " + t.text);
    if (preview.length) lines.push("未完成（前几条）：\n" + preview.join("\n"));
    if (active.length > 5) lines.push("…");
    lines.push("\n在 ai-api.js 中设置 TodoAppAiApi.config.endpoint 后，将请求该地址并显示模型总结。");
    return lines.join("\n");
  }

  async function runAiSummary() {
    if (!$btnAi || !$aiOut) return;
    $btnAi.disabled = true;
    $aiOut.classList.remove("is-placeholder");
    $aiOut.textContent = "正在生成…";
    const snap = snapshotTodosForApi();
    try {
      const api = typeof TodoAppAiApi !== "undefined" ? TodoAppAiApi : null;
      if (api && typeof api.requestSummary === "function") {
        const r = await api.requestSummary(snap);
        if (r.ok) {
          $aiOut.textContent = r.text;
          return;
        }
        if (r.error === "NO_ENDPOINT") {
          $aiOut.textContent = buildLocalTodoSummary(snap);
          $aiOut.classList.add("is-placeholder");
          return;
        }
        $aiOut.textContent =
          "远程接口未成功（" + r.error + "）。以下为本地摘要：\n\n" + buildLocalTodoSummary(snap);
        return;
      }
      $aiOut.textContent = buildLocalTodoSummary(snap);
      $aiOut.classList.add("is-placeholder");
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      $aiOut.textContent = "接口异常：" + msg + "\n\n本地摘要：\n" + buildLocalTodoSummary(snap);
    } finally {
      $btnAi.disabled = false;
    }
  }

  function syncDueShell() {
    if (!$dueWrap || !$due) return;
    $dueWrap.classList.toggle("has-value", Boolean($due.value));
  }

  /** 在用户手势内打开系统日历（支持 Chromium / Firefox 较新版本） */
  function openDueDatePicker() {
    if (!$due) return;
    try {
      if (typeof $due.showPicker === "function") {
        $due.showPicker();
        return;
      }
    } catch (_) {
      /* file:// 或非安全上下文等场景会抛错 */
    }
    $due.focus();
  }

  function normalizeDueDate(v) {
    if (v == null || v === "") return null;
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    return null;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        todos = parsed
          .filter(
            (t) =>
              t &&
              typeof t.id === "string" &&
              typeof t.text === "string" &&
              typeof t.completed === "boolean" &&
              typeof t.createdAt === "number"
          )
          .map((t) => ({
            ...t,
            dueDate: normalizeDueDate(t.dueDate),
          }));
      }
    } catch (_) {
      todos = [];
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const opts = sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
    return d.toLocaleString("zh-CN", opts);
  }

  /** @param {string} ymd */
  function parseYmdLocal(ymd) {
    const [y, m, day] = ymd.split("-").map(Number);
    return new Date(y, m - 1, day);
  }

  /** @param {Date} d */
  function startOfLocalDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  /** @param {Todo} t */
  function dueDayStatus(t) {
    if (!t.dueDate) return null;
    const due = startOfLocalDay(parseYmdLocal(t.dueDate));
    const today = startOfLocalDay(new Date());
    if (due < today) return "overdue";
    if (due === today) return "today";
    return "future";
  }

  /** @param {string} ymd */
  function formatDueLabel(ymd) {
    return parseYmdLocal(ymd).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  }

  function visibleTodos() {
    if (filter === "active") return todos.filter((t) => !t.completed);
    if (filter === "completed") return todos.filter((t) => t.completed);
    return todos;
  }

  function render() {
    const items = visibleTodos();
    const completedCount = todos.filter((t) => t.completed).length;
    const activeCount = todos.length - completedCount;

    $list.innerHTML = "";

    if (items.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent =
        todos.length === 0
          ? "还没有任务，在上方输入并添加第一条吧。"
          : filter === "active"
            ? "没有未完成的任务。"
            : filter === "completed"
              ? "还没有已完成的任务。"
              : "没有可显示的任务。";
      $list.appendChild(empty);
    } else {
      for (const t of items) {
        const li = document.createElement("li");
        const overdue =
          Boolean(t.dueDate && !t.completed && dueDayStatus(t) === "overdue");
        li.className =
          "item" +
          (t.completed ? " item-done" : "") +
          (overdue ? " item-overdue" : "");
        li.dataset.id = t.id;

        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.className = "toggle";
        toggle.checked = t.completed;
        toggle.setAttribute("aria-label", t.completed ? "标记为未完成" : "标记为完成");
        toggle.addEventListener("change", () => {
          const todo = todos.find((x) => x.id === t.id);
          if (todo) {
            todo.completed = toggle.checked;
            save();
            render();
          }
        });

        const body = document.createElement("div");
        body.className = "item-body";

        const p = document.createElement("p");
        p.className = "item-text";
        p.innerHTML = escapeHtml(t.text);

        const meta = document.createElement("p");
        meta.className = "item-meta";
        meta.textContent = "创建于 " + formatTime(t.createdAt);

        const dueRow = document.createElement("div");
        dueRow.className = "item-due-row";

        const dueLbl = document.createElement("span");
        dueLbl.className = "item-due-label";
        dueLbl.textContent = "截止日期";

        const dateInput = document.createElement("input");
        dateInput.type = "date";
        dateInput.className = "input-date-inline";
        dateInput.setAttribute("aria-label", "截止日期");
        dateInput.value = t.dueDate || "";
        dateInput.addEventListener("change", () => {
          const todo = todos.find((x) => x.id === t.id);
          if (!todo) return;
          todo.dueDate = normalizeDueDate(dateInput.value);
          save();
          render();
        });

        dueRow.appendChild(dueLbl);
        dueRow.appendChild(dateInput);

        if (t.dueDate) {
          const badge = document.createElement("span");
          badge.className = "due-badge";
          badge.textContent = formatDueLabel(t.dueDate);
          if (!t.completed) {
            const st = dueDayStatus(t);
            if (st === "overdue") badge.classList.add("is-overdue");
            else if (st === "today") badge.classList.add("is-today");
          }
          dueRow.appendChild(badge);
        }

        body.appendChild(p);
        body.appendChild(meta);
        body.appendChild(dueRow);

        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn btn-icon";
        del.setAttribute("aria-label", "删除");
        del.innerHTML =
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"/></svg>';
        del.addEventListener("click", () => {
          todos = todos.filter((x) => x.id !== t.id);
          save();
          render();
        });

        li.appendChild(toggle);
        li.appendChild(body);
        li.appendChild(del);
        $list.appendChild(li);
      }
    }

    $footer.textContent =
      todos.length === 0
        ? ""
        : `共 ${todos.length} 条 · 未完成 ${activeCount} · 已完成 ${completedCount}`;

    $clearDone.hidden = completedCount === 0;
  }

  $form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $input.value.trim();
    if (!text) return;
    todos.unshift({
      id: uid(),
      text,
      completed: false,
      createdAt: Date.now(),
      dueDate: normalizeDueDate($due.value),
    });
    $input.value = "";
    $due.value = "";
    syncDueShell();
    save();
    render();
    $input.focus();
  });

  $clearDone.addEventListener("click", () => {
    todos = todos.filter((t) => !t.completed);
    save();
    render();
  });

  $filters.forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = btn.getAttribute("data-filter");
      if (f !== "all" && f !== "active" && f !== "completed") return;
      filter = f;
      $filters.forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      render();
    });
  });

  $due.addEventListener("input", syncDueShell);
  $due.addEventListener("change", syncDueShell);
  $due.addEventListener("click", openDueDatePicker);
  $dueWrap.addEventListener("click", (e) => {
    if (e.target !== $due) openDueDatePicker();
  });

  if ($btnAi) $btnAi.addEventListener("click", runAiSummary);

  load();
  render();
  syncDueShell();
  if ($aiOut) {
    $aiOut.classList.add("is-placeholder");
    $aiOut.textContent = "点击「生成总结」查看本地摘要；配置 API 后将显示模型结果。";
  }
  $input.focus();
})();
