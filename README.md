# SmartFin

SmartFin 是一个面向新加坡贸易/进出口企业的财务运营管理系统。  
当前仓库已按最新需求与技术文档完成第一轮架构重建（就地替换）。

## 当前架构（Round 1）

- SvelteKit + Cloudflare Workers（主应用 Worker）
- D1（Drizzle Schema + Migration）
- R2（文件存储）
- KV（配置读取）
- Cloudflare Queues（OCR producer）
- 独立 OCR consumer Worker 骨架（`workers/ocr-consumer.ts`）
- API 骨架：`upload/ocr/projects/invoices/tax/dashboard`

## 本地开发

```sh
npm install
npm run gen
npm run db:migrate:local
npm run db:seed:local
npm run dev:cf
```

## 关键命令

```sh
# 生成 D1 迁移
npm run db:generate

# 应用 D1 迁移（本地 / 远端）
npm run db:migrate:local
npm run db:migrate:remote

# 本地最小演示数据（customers）
npm run db:seed:local

# 类型检查 + 构建
npm run check
npm run build
```

## 环境变量

复制 `.env.example` 为 `.env`，并填入 Cloudflare/Auth（以及可选 OCR/LLM）配置：

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_D1_DATABASE_ID`
- `OCR_API_URL` (optional)
- `OCR_API_KEY` (optional)
- `LLM_API_URL` (optional)
- `LLM_API_KEY` (optional)

## OCR Consumer Worker（独立部署）

```sh
npm run deploy:ocr-consumer
```
