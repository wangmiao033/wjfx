# Vercel 部署指南

## 1. 前置准备

| 服务 | 用途 | 获取地址 |
|------|------|----------|
| [Supabase](https://supabase.com) | PostgreSQL 数据库 | 免费项目即可 |
| [Vercel](https://vercel.com) | 托管 Next.js | 连接 GitHub 仓库 |
| [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) | 文件存储 | Vercel Dashboard → Storage |
| [Resend](https://resend.com) | 邮件验证码（可选） | 注册 API Key |

---

## 2. 环境变量清单

在 **Vercel → Project → Settings → Environment Variables** 中配置以下变量。

### 必填

| 变量名 | 说明 | 示例 / 获取方式 |
|--------|------|-----------------|
| `DATABASE_URL` | Supabase 连接串（Transaction pooler，端口 **6543**） | `postgresql://postgres.xxx:密码@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Supabase 直连（Session mode，端口 **5432**） | `postgresql://postgres.xxx:密码@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` |
| `NEXTAUTH_SECRET` | JWT 签名密钥，至少 32 位随机字符串 | 终端执行 `openssl rand -base64 32` |
| `NEXTAUTH_URL` | 站点完整 URL | `https://你的项目.vercel.app` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 读写 Token | Vercel → Storage → Blob → `.env.local` 中复制 |

### 可选

| 变量名 | 说明 | 不配置时的行为 |
|--------|------|----------------|
| `RESEND_API_KEY` | Resend 邮件 API Key | 注册验证码仅在服务端日志输出 |
| `EMAIL_FROM` | 发件人地址 | 默认 `onboarding@resend.dev` |
| `CRON_SECRET` | 过期文件清理接口鉴权 | Cron 接口不校验（不推荐生产环境） |

> **Supabase 连接串位置：** Project Settings → Database → Connection string → 选择 URI，分别复制 Transaction pooler 和 Session pooler。

---

## 3. 部署步骤

### 3.1 连接 GitHub 并部署

1. Vercel → Add New Project → 导入 `wangmiao033/wjfx`
2. 填入上方环境变量（Production + Preview 建议都配）
3. 点击 Deploy

### 3.2 初始化数据库表结构

首次部署后，在本地（已配置 `.env` 指向 Supabase）执行：

```bash
npx prisma db push
```

或在 Supabase SQL Editor 中手动执行 `prisma db push` 生成的 SQL。

### 3.3 创建 admin 账号

```bash
node scripts/seed-admin.mjs
```

默认账号：

| 字段 | 值 |
|------|-----|
| 账号 | `admin` |
| 邮箱 | `admin@wjfx.local` |
| 密码 | `911030` |

生产环境建议部署后立即修改密码。

---

## 4. 本地开发（与线上一致）

```bash
# 1. 复制环境变量模板
cp .env.example .env

# 2. 填入 Supabase 连接串（可与线上共用同一项目，或单独建 dev 项目）

# 3. 安装依赖并同步数据库
npm install
npx prisma db push
node scripts/seed-admin.mjs

# 4. 启动开发服务器
npx next dev -p 3000
```

> 本地与线上均使用 **PostgreSQL**，不再使用 `prisma/dev.db`。旧的 SQLite 文件可安全删除。

---

## 5. Vercel Cron（过期文件清理）

项目已配置 `vercel.json` 定时任务，每天 3:00 UTC 调用 `/api/cron/cleanup`。

确保配置了 `CRON_SECRET`，Vercel Cron 会自动携带 `Authorization: Bearer <CRON_SECRET>` 请求头。

---

## 6. 常见问题

**Q: 登录报「邮箱/账号或密码错误」**  
A: 确认已执行 `node scripts/seed-admin.mjs`，且 `DATABASE_URL` 指向正确的 Supabase 项目。

**Q: 上传失败**  
A: 检查 `BLOB_READ_WRITE_TOKEN` 是否已配置，Vercel Blob Store 是否已创建。

**Q: 注册收不到验证码**  
A: 配置 `RESEND_API_KEY` 和已验证的 `EMAIL_FROM` 域名。

**Q: `prisma db push` 报连接错误**  
A: `DATABASE_URL` 用 6543 端口 + `?pgbouncer=true`；`DIRECT_URL` 用 5432 端口。
