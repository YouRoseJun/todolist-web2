# TodoList Web

一个简洁的待办清单网页应用，支持任务新增、完成切换、状态筛选和 AI 总结展示。

## 在线体验

- GitHub Pages: https://yourosejun.github.io/todolist-web2/

## 功能特性

- 添加待办任务，支持可选截止日期
- 标记任务已完成/未完成
- 按全部、未完成、已完成筛选任务
- 一键清除已完成任务
- AI 总结面板（通过 `ai-api.js` 配置接口）

## 本地运行

这是纯前端静态项目，直接双击 `index.html` 即可运行，或使用任意静态服务器打开。

## 接入后端 AI 接口（OpenAI / DeepSeek）

1. 启动后端服务：
   - `cd backend`
   - `npm install`
   - 复制 `.env.example` 为 `.env` 并填入 `AI_API_KEY`
   - `npm run dev`
2. 在前端页面中设置 API 地址（任选其一）：
   - 直接修改 `ai-api.js` 中 `config.endpoint`
   - 或在 `index.html` 的脚本前设置：
     - `window.TODO_AI_API_ENDPOINT = "http://localhost:3000/api/ai-summary";`
3. 回到页面点击「生成总结」，即可看到模型返回结果。

后端默认使用 OpenAI 兼容协议的 `POST /chat/completions`，通过 `.env` 切换厂商：

- OpenAI:
  - `AI_BASE_URL=https://api.openai.com/v1`
  - `AI_MODEL=gpt-4o-mini`
- DeepSeek:
  - `AI_BASE_URL=https://api.deepseek.com`
  - `AI_MODEL=deepseek-chat`

## 后端上线（Render）

仓库已包含 `render.yaml`，可直接按 Blueprint 部署。

1. 打开 Render 控制台，选择 **New +** -> **Blueprint**
2. 连接你的 GitHub 并选择仓库 `YouRoseJun/todolist-web2`
3. Render 会读取 `render.yaml` 并创建服务 `todolist-ai-backend`
4. 在环境变量中填写：
   - `AI_API_KEY`（必填）
   - 如果用 DeepSeek，再改：
     - `AI_BASE_URL=https://api.deepseek.com`
     - `AI_MODEL=deepseek-chat`
5. 首次部署成功后会得到后端地址，例如：
   - `https://todolist-ai-backend.onrender.com`
6. 在 `index.html` 中增加（放在 `ai-api.js` 之前）：
   - `window.TODO_AI_API_ENDPOINT = "https://todolist-ai-backend.onrender.com/api/ai-summary";`
7. 提交并推送前端后，GitHub Pages 上点击「生成总结」即可调用线上后端。

## 项目结构

- `index.html`：页面结构
- `styles.css`：界面样式
- `app.js`：待办清单核心逻辑
- `ai-api.js`：AI 总结接口配置与调用
- `backend/server.js`：AI 总结后端示例（含超时、CORS、错误处理）
- `render.yaml`：Render Blueprint 部署配置
