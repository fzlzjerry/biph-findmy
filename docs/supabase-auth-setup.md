# Supabase 登录邮件设置

网站用 Supabase Auth 给 `@basischina.com` 邮箱发 6 位验证码。除了发信邮箱（SMTP），其他设置都已经通过管理接口配好了：

```bash
supabase login                                    # 一次性登录，令牌存在 ~/.supabase/access-token
uv run python scripts/configure_supabase_auth.py  # 可重复执行
```

- 项目：`biph-findmy`（新加坡），控制台：<https://supabase.com/dashboard/project/vysbjwnojtbykmgmtrdo>

| 设置 | 值 | 状态 |
|---|---|---|
| 验证码 | 6 位，10 分钟有效 | ✅ |
| Site URL | `https://biph-findmy.vercel.app` | ✅ |
| 只允许学校邮箱注册 | Before User Created hook → `public.hook_restrict_signup_domain`（[迁移文件](../supabase/migrations/0002_signup_domain_hook.sql)） | ✅ |
| 登录 / 验证频率上限 | 每 IP 每 5 分钟 300 次（全校的请求都从我们的服务器发出） | ✅ |
| **自定义 SMTP** | 见下文 | ⏳ 需要一个邮箱的授权码 |
| 中英双语验证码邮件模板 | [`supabase/templates/otp-email.html`](../supabase/templates/otp-email.html) | ⏳ 免费版要先配好 SMTP 才能改；配好后重新运行上面的脚本 |
| 发信上限 | 每小时 100 封 | ⏳ 同上 |

> **为什么一定要配 SMTP**：Supabase 自带的发信服务**只能发给你 Supabase 组织里的成员**，每小时最多 2 封，而且免费版不允许修改邮件模板。

## SMTP：用一个邮箱帮网站发信

**Authentication → Emails → SMTP Settings → Enable custom SMTP**。Sender name 填 `BIPH FindMy`；Sender email 必须和 SMTP 账号是同一个邮箱地址（Resend 除外）。

| 方式 | Host | Port | Username | Password | 说明 |
|---|---|---|---|---|---|
| **QQ 邮箱** | `smtp.qq.com` | `465` | 完整的 QQ 邮箱地址 | **授权码**（不是 QQ 密码） | QQ 邮箱 → 设置 → 账号 → 开启「POP3/SMTP 服务」后生成 |
| **163 邮箱** | `smtp.163.com` | `465` | 完整邮箱地址 | **授权码** | 设置 → POP3/SMTP/IMAP → 开启 SMTP 服务 |
| **Gmail** | `smtp.gmail.com` | `465` | Gmail 地址 | **应用专用密码** | 要先开两步验证；每天约 500 封 |
| **Resend**（以后有域名时推荐） | `smtp.resend.com` | `465` | `resend` | Resend 的 API key | 要先验证自己的域名；发件人可以是 `noreply@你的域名` |

最好专门注册一个社团用的邮箱来发信，不要用个人主邮箱。配好 SMTP 以后，再运行一次 `scripts/configure_supabase_auth.py`，验证码邮件模板和发信上限就会自动设上。

## 用学校邮箱实测一次

学校邮箱可能会把新发件人直接隔离，所以**越早测越好**：

1. 打开 <https://biph-findmy.vercel.app/login>，输入你的 `@basischina.com` 邮箱。
2. 去收件箱、垃圾邮件和隔离区找验证码。
3. 如果被隔离了，请学校 IT 把发件邮箱加进白名单。

## 网站这一侧（Vercel 环境变量）

| 变量 | 值 |
|---|---|
| `ALLOWED_EMAIL_DOMAINS` | `basischina.com` ✅ |
| `ADMIN_EMAILS` | 前台老师和社团干部的邮箱，多个用英文逗号分隔。他们登录后能看到管理后台和前台快速登记。⏳ |

后端会在每个请求上都检查邮箱域名，Supabase 的 hook 是第二道防线：就算有人绕过网站，直接调用 Supabase，也注册不了非学校邮箱，更消耗不了你的发信额度。
