# 自托管备用方案 · Self-hosting fallback

线上网站跑在 Vercel 上。如果校园网打不开 `*.vercel.app`，而且绑了自定义域名也不行，可以把同一套代码用 Docker 跑在自己的服务器上。代码和匹配引擎都一样，默认用 SQLite 加本地磁盘存数据。

## 选哪种服务器

| 方案 | 优点 | 注意 |
|---|---|---|
| **香港云服务器**（阿里云、腾讯云轻量应用服务器等，约 ¥30–60/月，选 2 核 2 GB 以上） | 大陆访问快；绑域名**不需要 ICP 备案**；能正常连 Supabase 和 GitHub | 要付费，要有人维护 |
| **学校服务器**（只在校园网内访问） | 免费，在校内最快 | 需要 IT 老师配合；如果要对公网开放，域名需要 ICP 备案；服务器要能访问 `supabase.co` 才能发登录验证码 |

匹配模型需要大约 1 GB 内存，所以服务器至少要 2 GB 内存。

## 部署步骤

1. 安装 Docker（含 Docker Compose）：<https://docs.docker.com/engine/install/>
2. 拉代码并准备配置：

   ```bash
   git clone https://github.com/fzlzjerry/biph-findmy.git && cd biph-findmy
   cp .env.example .env
   ```

3. 编辑 `.env`，至少改这几项：

   ```ini
   AUTH_BACKEND=supabase
   SUPABASE_URL=https://vysbjwnojtbykmgmtrdo.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # Supabase → Project Settings → API Keys
   ALLOWED_EMAIL_DOMAINS=...                     # 学校邮箱域名
   ADMIN_EMAILS=...                              # 前台老师、社团干部
   CRON_SECRET=...                               # 随便生成一串长随机字符
   DEV_SHOW_CODE=false
   ```

   数据有两种存法：
   - **默认**：SQLite 加本地磁盘，存在 Docker 卷 `findmy-data` 里，和 Vercel 上的数据是分开的。
   - **和线上共用**：把 `DATABASE_URL` 设成和 Vercel 一样的 Supabase 连接串；`STORAGE_BACKEND=blob` 并填上 `BLOB_READ_WRITE_TOKEN`，照片也会共用。这样两边看到的是同一份数据，可以随时切换。

4. 启动。有域名就写域名，Caddy 会自动申请 HTTPS 证书；没有域名就先用 IP 访问：

   ```bash
   SITE_ADDRESS=findmy.example.com docker compose up -d --build
   # 或者：docker compose up -d --build    → http://服务器IP/
   ```

5. 检查：打开 `https://你的域名/api/health`，应该看到 `"ok": true, "model_loaded": true`。

### 在大陆服务器上构建

大陆网络下载 npm、PyPI 和 Hugging Face 会很慢，甚至下载失败，构建时加上镜像参数：

```bash
docker compose build \
  --build-arg NPM_REGISTRY=https://registry.npmmirror.com \
  --build-arg PYPI_INDEX=https://mirrors.aliyun.com/pypi/simple \
  --build-arg HF_ENDPOINT=https://hf-mirror.com
docker compose up -d
```

## 日常维护

- **每天归档过期物品**：Vercel 上有定时任务，自托管要自己在服务器上加 crontab（每天北京时间凌晨 3 点）：

  ```cron
  0 19 * * * curl -fsS -H "Authorization: Bearer 你的CRON_SECRET" https://findmy.example.com/api/cron/expire
  ```

- **备份**（使用 SQLite 时）：

  ```bash
  docker run --rm -v biph-findmy_findmy-data:/data -v "$PWD":/backup alpine \
    tar czf /backup/findmy-$(date +%F).tgz -C /data .
  ```

- **更新**：`git pull && docker compose up -d --build`
- **看日志**：`docker compose logs -f app`

## 和 Vercel 版本的区别

| | Vercel | 自托管 |
|---|---|---|
| 静态文件 | Vercel CDN | Caddy（gzip/zstd 压缩，带缓存头） |
| 安全响应头 / CSP | `vercel.json` | `deploy/Caddyfile`，内容相同 |
| 定时任务 | Vercel Cron | 服务器 crontab |
| 冷启动 | 闲置一段时间后第一次请求约 3 秒 | 没有冷启动，一直在线 |
