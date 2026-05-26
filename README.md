# SmartFin

[简体中文](./README.md) | [English](./README.en.md)

SmartFin 是面向新加坡中小企业的财务运营系统：AR 文档与发票、以项目为中心的盈利与成本、人员与税务汇总。当前代码库已完成**服务端模块化重构**：业务按域划分模块，路由层通过模块 API 编排，并与可配置的模块开关配合运行。

---

## 1. 核心能力


- **AR**：文档上传（含 ZIP 批处理）、OCR/LLM 分类与抽取、客户/供应商侧单据与项目归档
- **客户发票**：草稿保存与重编辑、A4 预览、文字型 PDF 生成与可选入库（R2）
- **项目**：项目详情、合同/报价/采购单/进销项发票、成员与费用等子页；项目利润视图
- **员工**：员工列表与详情（与人员/项目成员模型联动）；个税相关展示与 API
- **税务**：GST 季度视图、Corporate / Individual Tax 汇总接口与页面
- **报表与仪表盘**：Dashboard KPI、项目利润报表与导出
- **AI Agent（v2）**：
  - 全局聊天入口（右下角浮动对话框）
  - **两层 Agent 架构**：Router Agent（意图分类）→ Domain Agent（动作选择）
  - 支持 `query` / `action` / `chat` 三种意图类型
  - **Query 类型直接返回数据**：如项目利润、项目列表等，以结构化卡片展示
  - 按用户角色过滤可执行 action
  - 页面跳转与表单预填（支持日期格式解析、下拉框匹配）
  - **继续追问**模式：保持上下文连续对话
  - 项目页自动注入 `project_id` / `project_name` 上下文
- **OCR 增强**：
  - **Workers AI Vision**：Llama 3.2 Vision 模型，支持图像/扫描 PDF OCR
  - **PaddleOCR**：可选本地 HTTP 服务（开发环境推荐）
  - 图像文档 OCR 路径：PaddleOCR 优先 → Workers AI Vision 回退

> **已知产品边界**：`Generate & send` 中「send」尚未接真实邮件；OCR 消费者可单独部署，主 Worker 侧为队列生产者（详见 `wrangler.jsonc` 与 `workers/`）。

---

## 2. 技术栈

| 层级 | 选型 |
|------|------|
| 前端 / 全栈框架 | SvelteKit（Svelte 5） |
| 运行时 | Cloudflare Workers（`adapter-cloudflare`） |
| 数据库 | Cloudflare D1 + Drizzle ORM |
| 文件 | Cloudflare R2 |
| 配置 | Cloudflare KV（如公司设置、模块开关） |
| 异步 | Cloudflare Queues（OCR 等） |
| 认证 | better-auth |
| 校验 | zod |

关键依赖（业务相关）：`pdfjs-dist`、`fflate`、`pdf-lib`；`html2canvas` / `jspdf` 仍在依赖中，发票主流程以 `pdf-lib` 为主。

---

## 3. 后端模块化架构

### 3.1 设计要点

- **`ModuleRegistry`**（`src/lib/server/modules/registry.ts`）：注册各域模块，解析依赖、校验启用子集、计算初始化顺序。
- **`ModuleDefinition`**：每个模块提供 `manifest`（`id`、`layer`、`dependencies`）与可选的 `registerHandlers`（挂接领域事件）。
- **`ModuleContext`**：请求级上下文（`env`、`db`、`user`、`eventBus`），由 `createModuleContext(event)` 创建；**路由与 `+server` 应通过各模块 `api.ts` 访问数据，而不是直接导入 `$lib/server/db`**。
- **事件总线**（`event-bus.ts`）：模块间通过约定的事件名协作（各模块 `events.ts`）。
- **启动注册**：`src/lib/server/modules/register-all.ts` 统一 `registry.register(...)`；`hooks.server.ts` 侧载该文件以保证进程内注册完成。

### 3.2 模块清单与依赖

| 模块 ID | 名称 | Layer | 依赖 |
|---------|------|-------|------|
| `core` | Core | core | — |
| `person` | Person | base | core |
| `business-partner` | Business Partner | base | core, person |
| `project` | Project | base | core, person, business-partner |
| `ar` | Accounts Receivable | base | core, business-partner, project |
| `employee` | Employee | base | core, person, project |
| `expense` | Expense | base | core, project |
| `tax` | Tax | feature | core, person, ar, employee |
| `reporting` | Reporting | feature | core, project, ar, employee, expense |

### 3.3 运行时模块开关

- 启用列表存于 **`company_settings`** 的键 **`modules.enabled`**（JSON 数组，模块 ID）。
- 若配置缺失、非法或**依赖不满足**，系统回退为**启用全部已注册模块**（保证可用性）。
- 路径前缀与模块的对应关系见 `src/lib/server/modules/enabled.ts`（用于判断某 URL 是否在当前启用集合内）。
- **未映射到任一业务模块前缀的 API**（例如 `/api/upload/*`、`/api/ocr/*`、`/api/invoices/*` 等）在鉴权通过后**始终可访问**，便于横向能力与 AR/项目页面共用。

管理接口：

- `GET /api/settings/modules` — 当前启用列表与依赖校验结果  
- `PUT /api/settings/modules` — 更新启用列表（需通过业务权限）

### 3.4 路由层边界（与模块化设计配套）

- `src/routes/**/+server.ts` 与 `+page.server.ts` **禁止**直接 `import '$lib/server/db'`（CI 由 `npm run check:modular-boundary` 约束，例外见 `scripts/modular-boundary-allowlist.txt`）。
- 详细约定见 **`src/lib/server/modules/MODULARIZATION_GUIDE.md`**。

---

## 4. 领域模型与参考设计

实现与 **`ref_files/SmartFin_模块设计_Project_Employee_Expense.md`** 中的思路对齐，便于后续迭代：

- **项目（Project）为中心**：客户/供应商（Business Partner）、成员、单据与费用围绕项目组织。
- **人员（Person）与雇员（Employee）**：身份与雇佣信息分层；员工依赖 `person` 与 `project`。
- **费用（Expense）**：支持 **COGS / OpEx** 与 **归因类型**（`direct` / `allocated` / `company`），与「项目直接成本 vs 公司运营成本」区分一致；细则以表结构与 `src/lib/server/modules/expense/schema.ts` 为准。

历史过程说明见 **`ref_files/process/README.md`**（里程碑与产品边界快照）。

---

## 5. 目录结构（重构后）

```text
src/
  routes/
    (app)/                    # 需登录的业务壳（顶栏导航按模块开关显示）
    (auth)/                   # 登录等
    api/                      # HTTP API（轻编排 → 模块 API）
  lib/
    server/
      modules/                # 按域模块：core, person, business-partner, project, ar, employee, expense, tax, reporting
        registry.ts           # 模块注册表
        register-all.ts       # 统一注册入口
        enabled.ts            # 路径 ↔ 模块、启用列表读取
        event-bus.ts
        **/api.ts             # 对外模块 API（路由应调用）
        **/schema.ts          # Drizzle 表定义（按域拆分）
        **/handlers.ts        # 事件注册
      db.ts                   # D1 客户端入口（仅模块层 / 基础设施使用）
      ocr/                    # OCR/LLM 管线（供 API 调用）
      auth/                   # 会话与权限
workers/
  ocr-consumer.ts             # OCR 队列消费者（独立 wrangler 配置）
scripts/
  check-modular-boundary.mjs  # 路由层禁止直连 db
drizzle/
  migrations/
  seeds/
wrangler.jsonc                # 主 Worker：D1 / R2 / KV / Queue / AI
```

---

## 6. 页面地图（主壳：`src/routes/(app)/+layout.svelte`）

| 区域 | 路径 |
|------|------|
| Dashboard | `/dashboard` |
| AR 总览与子导航 | `/ar`、`/ar/contracts`、`/ar/quotations`、`/ar/purchase-orders`、`/ar/customer-invoices`、`/ar/customer-invoices/generate`、`/ar/supplier-invoices`、`/ar/document-upload`（含 `project` / `record`） |
| Projects | `/projects`、`/projects/new`、`/projects/[id]`（含 contracts、quotations、purchase-orders、invoices、expenses、employees 等子路由） |
| Employees | `/employees`、`/employees/new`、`/employees/[id]` |
| Tax | `/tax`、`/tax/corporate`、`/tax/gst/[year]/[quarter]/box/[n]`、`/tax/settings` |
| Reports | `/reports` |
| Settings | `/settings`（模块开关等） |

---

## 7. API 地图（核心）

以下为常用端点；未列出部分请以 `src/routes/api` 为准。

**上传与文件**

- `POST /api/upload/presign`、`PUT|POST /api/upload/direct`、`POST /api/upload/confirm`
- `GET /api/files?key=...`

**OCR / LLM**

- `POST /api/ocr/workers-vision`：图像 OCR（Workers AI Vision / PaddleOCR）
- `POST /api/ocr/llm-classify`、`POST /api/ocr/llm-extract`、`POST /api/ocr/llm-email-intent`、`POST /api/ocr/llm-attachment-rank`
- `GET /api/ocr/status/[id]`、`POST /api/ocr/[id]/confirm`

**AI Agent**

- `POST /api/agent/intent`：接收自然语言、页面上下文与对话历史，返回：
  - `reply`：回复文本
  - `matched_action_id`：匹配的动作 ID
  - `prefill`：表单预填数据
  - `data`：Query 类型直接返回的结构化数据（利润、列表等）
  - `action`：导航目标（含 `entry` 路径）
  - `missing_context`：缺失的必要上下文字段
- 支持 `history` 参数实现多轮对话
- Provider 策略：优先 Workers AI（`platform.env.AI`），不可用时自动回退 external LLM（OpenAI 兼容接口），两者都失败再走降级文案

**客户发票**

- `POST /api/invoices/out`、`PUT /api/invoices/out/[id]`
- `GET /api/invoices/out/[id]/preview`、`POST /api/invoices/out/[id]/pdf`、`POST /api/invoices/out/[id]/import-lines`

**项目 / 仪表盘 / 报表**

- `GET|POST /api/projects`、`GET|PATCH /api/projects/[id]`、`GET /api/projects/[id]/profit`
- `GET /api/dashboard/overview`、`GET /api/dashboard/projects-profit`、`GET /api/dashboard/charts`
- `GET /api/reports/projects-profit/export`

**税务**

- `GET /api/tax/gst/[year]/[quarter]`、`GET /api/tax/gst/[year]/[quarter]/box/[n]`
- `GET /api/tax/corporate/[year]`、`GET /api/tax/individual/[employeeId]/[year]`

**设置与模块**

- `GET|PUT /api/settings/modules`

**其他**

- `GET|POST /api/customers`（客户列表等）
- `POST /api/ar/save-project-document`（项目文档归档）

---

## 8. 常用命令

```bash
npm install
npm run gen                    # wrangler types
npm run db:migrate:local
npm run db:seed:local
npm run dev:cf                 # 构建后以 Wrangler 本地跑 Worker（推荐）
```

开发与检查：

```bash
npm run check                  # 含模块化边界检查 + svelte-check
npm run check:modular-boundary
npm run build
```

可选数据：

```bash
npm run db:seed:mock:local
npm run db:test:mock:local
```

数据库：

```bash
npm run db:generate
npm run db:migrate:local
npm run db:migrate:remote
```

拉取含 **Drizzle / 模块化 schema** 的更新后务必执行 **`db:migrate:local`**（或远程 **`db:migrate:remote`**）；若保存 AR 文档报「no column named …」，多为本地库未跟上 `drizzle/migrations/` 中的新迁移。

---

## 9. 部署

**主应用**

```bash
npm run build
wrangler deploy
```

配置见 **`wrangler.jsonc`**（D1、R2、KV、队列、AI 等绑定）。

**OCR Consumer（独立 Worker）**

```bash
npm run deploy:ocr-consumer
```

配置见 **`workers/wrangler.ocr-consumer.jsonc`**。

---

## 10. 环境变量

**三种本地运行方式（任选）**：① **`npm run dev`** / **`npm run dev:vite`** — 纯 Vite，无 Cloudflare 绑定，适合只改 UI；② **`npm run dev:cf`** — 构建后用 Wrangler 本地 Worker（**推荐**全功能）；③ **`npm run preview`** — 构建后在 4173 端口验收产物。① 读项目根 **`.env`**（模板：**`.env.example`**）；②③ 读 **`wrangler.jsonc`** + **`.dev.vars`**（模板：**`.dev.vars.example`**），**不会自动加载 `.env`**，密钥类变量若既要跑 Vite 又要跑 Wrangler，请在两处各写一份并保持同名变量一致。

本地与生产至少配置 **`BETTER_AUTH_SECRET`**；**`BETTER_AUTH_URL`** 在生产须与线上访问 origin 一致（无尾斜杠）。使用 **`npm run dev:cf`** 时，请在项目根创建 **`.dev.vars`**，至少写入 `BETTER_AUTH_SECRET=`。仅放在 `.env` 里不会注入到 Worker，会导致 `/api/auth/*` 返回 404。本地 localhost 下应用会按请求 origin 自动对齐 auth 基地址，一般无需在 `.dev.vars` 里重复写 `BETTER_AUTH_URL`。

Cloudflare 部署还需 **`CLOUDFLARE_ACCOUNT_ID`**、**`CLOUDFLARE_API_TOKEN`**、**`CLOUDFLARE_D1_DATABASE_ID`** 等（以你方流水线为准）；生产环境**必须**用 **`wrangler secret put BETTER_AUTH_SECRET`**（对应当前 Worker 项目）写入密钥，勿提交到仓库。**未设置该 Secret 时，`/api/auth/*`（含 `sign-up/email`）会直接 404**，响应常为 HTML（与静态资源 404 页类似）。

部署后若注册报 404：① 确认已为**该 Worker** 配置 `BETTER_AUTH_SECRET`；② **`wrangler.jsonc` 的 `BETTER_AUTH_URL`** 若与真实访问域名不一致（例如 vars 里仍是别的 `*.workers.dev`），代码会尽量按**当前请求的域名**对齐；仍建议在 vars 中改为你的正式访问 URL（无尾斜杠）。

**邮件（注册验证、忘记密码）**：生产环境请配置 **`RESEND_API_KEY`**（建议用 `wrangler secret put RESEND_API_KEY`）及 **`EMAIL_FROM`**（例如 `SmartFin <noreply@yourdomain.com>`，需与 Resend 已验证发件域一致）。未配置时仅打印日志，无法真实发信。**未在 Resend 验证自有域名前**，测试发信通常**只能发到你在 Resend 账户里登记/绑定的邮箱**；若要对任意收件人发信，请在 [Resend Domains](https://resend.com/domains) 验证域名并把 `EMAIL_FROM` 改为该域下的地址。

可选（OCR/LLM 外部服务）：`OCR_API_URL`、`OCR_API_KEY`、`LLM_API_URL`、`LLM_API_KEY`、`LLM_PROVIDER`、`OCR_PROVIDER` 等。

**AI 与 OCR 专用变量**：

| 变量 | 说明 |
|------|------|
| `WORKERS_AI_MODEL` | 文本 LLM 模型（默认 `@cf/meta/llama-3.1-8b-instruct`） |
| `WORKERS_AI_VISION_MODEL` | 视觉 OCR 模型（默认 `@cf/meta/llama-3.2-11b-vision-instruct`） |
| `PADDLE_OCR_URL` | 本地 PaddleOCR HTTP 服务地址（如 `http://127.0.0.1:8765`） |
| `OCR_PADDLE_ONLY` | 若为 `true`，仅使用 PaddleOCR，不回退 Workers AI |

AI Agent 复用相同的 LLM 配置项：本地若 Workers AI 不可用，会自动尝试 `LLM_API_URL` + `LLM_API_KEY`（例如 OpenAI）。

---

## 11. 已知边界与风险

- 邮件发送未接入（SMTP/第三方），发票以生成 + 本地下载 + 可选入库为主。
- OCR/LLM 依赖 provider 与配额，异常时需运维侧降级与重试策略。
- 文字型 PDF 与屏幕预览在极端内容下可能存在细微排版差异；打印时浏览器页眉页脚需用户在打印对话框中关闭。

---

## 12. 路线图（建议）

- [ ] 邮件发送闭环（模板、附件、状态回写）
- [ ] 发票 PDF 模板配置化与版本管理
- [ ] OCR 队列可观测性、死信与告警
- [ ] E2E：ZIP 上传、识别、生成发票、入库、税务汇总
- [ ] 统一财务字段字典（GST、币种、状态枚举）减少前后端分叉
- [ ] 逐步淘汰 `legacy-db` 桥接，路由全部走模块 API（见 `MODULARIZATION_GUIDE.md`）

---

## 13. 维护约定

- 发布里程碑时更新 **`ref_files/process/README.md`** 中的进度与边界说明（可选同步本 README 第 1、11、12 节）。
- 若接口或模块依赖有 breaking change，在本文件顶部追加简短 **CHANGELOG** 小节。
