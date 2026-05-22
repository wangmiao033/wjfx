---
Task ID: 1
Agent: Main Agent
Task: 全面优化升级 FileShare v2.0

Work Log:
- 修复 Prisma Schema：添加 User/VerificationCode 模型，SharedFile 增加 password/userId 字段
- 切换数据库从 SQLite 到 PostgreSQL（兼容 Supabase）
- 实现 NextAuth 认证系统（Credentials Provider + JWT 策略）
- 创建所有缺失 API 路由：/api/upload、/api/auth/register、/api/auth/send-code、/api/preview
- 创建 [...nextauth] 认证路由
- 修复安全漏洞：下载时验证密码、文件操作添加认证、删除权限校验
- Vercel Blob 切换私有模式 + 服务端流式代理下载
- 添加 Resend 邮件发送（开发模式自动回退显示验证码）
- 优化上传体验：XMLHttpRequest 真实进度、多文件并行上传状态显示
- 优化分享页面：独立密码验证流程、预览密码保护、复制状态反馈
- 添加过期文件自动清理 Cron API（每天3点执行）
- 添加 90 天有效期选项
- 生产环境优化：移除开发查询日志、流式下载

Stage Summary:
- 22 个文件修改/新增，987 行新增，215 行删除
- 本地构建成功，所有 17 个路由正确生成
- GitHub 推送失败（缺少认证凭据），需要用户提供 PAT 或手动推送
