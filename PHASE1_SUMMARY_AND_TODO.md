# SmartFin Phase 1 概括与待办

更新时间：2026-03-30

## 这一步已完成（大致概括）

已完成项目底座初始化，当前可作为后续模块开发起点：

- 技术底座：
  - `SvelteKit + TypeScript`
  - `Cloudflare Workers` 适配
  - `Tailwind CSS v3`
  - `Drizzle ORM`（D1 方向）
  - `better-auth` 依赖接入（认证骨架已预留）
- 工程结构：
  - 初始化了 `src/routes` 与 `src/lib/server` 的模块化目录
  - 建立了 `(auth)` 与 `(app)` 路由分组骨架
  - 搭建了 `dashboard / ar / projects / employees / tax / reports / settings` 占位页
- 数据与环境：
  - 增加 `drizzle.config.ts` 与迁移目录 `drizzle/migrations`
  - 增加 Cloudflare 资源绑定占位（D1 / R2 / KV / Queue）
  - 增加 `.env.example` 作为环境变量模板
- 质量验证：
  - `npm run check` 通过
  - 当前无 linter 报错

---

## 你需要手动完成的 TODO

以下内容需要你在本地/Cloudflare 控制台手动配置（关键）：

### 1) 复制环境变量文件

- 从项目根目录复制：
  - `.env.example` -> `.env`

### 2) 填写 `.env` 的真实值

当前需要填写：

- `BETTER_AUTH_SECRET`
  - 用于会话签名，必须是高强度随机字符串
- `BETTER_AUTH_URL`
  - 本地一般是 `http://localhost:5173`
  - 生产环境改成正式域名
- `CLOUDFLARE_ACCOUNT_ID`
  - Cloudflare 账号 ID
- `CLOUDFLARE_API_TOKEN`
  - 具有 D1 / R2 / KV / Queue 管理权限的 API Token
- `CLOUDFLARE_D1_DATABASE_ID`
  - D1 数据库 ID

### 3) 在 Cloudflare 上创建并绑定资源

请在 Cloudflare 创建（命名可按团队规范调整）：

- D1 数据库（当前配置名：`smartfin-local`）
- R2 Bucket（当前配置名：`smartfin-files`）
- KV Namespace（绑定名：`CONFIG_CACHE`）
- Queue（当前生产者队列名：`smartfin-document-jobs`）

然后把真实 ID/名称回填到：

- `wrangler.jsonc` 中的 `database_id`、`kv_namespaces.id` 等占位值

### 4) 生成 Cloudflare 类型

```bash
npm run gen
```

### 5) 生成并执行数据库迁移

```bash
# 生成迁移文件
npm run db:generate

# 本地 D1 执行迁移
npm run db:migrate:local

# 远端 D1 执行迁移（准备联调/部署时）
npm run db:migrate:remote
```

### 6) 运行项目并验证

```bash
npm run dev
```

建议至少检查：

- 首页、`/login`、`/dashboard` 是否可访问
- 控制台页面路由是否正常跳转
- 构建检查是否通过：`npm run check`

---

## 下一阶段建议（开发顺序）

建议按以下顺序继续：

1. 接入 `better-auth` 真实登录/会话（替换当前占位逻辑）
2. 落地 `Organization / User / Role` 首批表与基础 CRUD
3. 完成项目级权限与 `organization_id` 级数据隔离
4. 进入 AR 核心流程（Supplier Invoice 上传 -> OCR 异步任务 -> 人工校验）

