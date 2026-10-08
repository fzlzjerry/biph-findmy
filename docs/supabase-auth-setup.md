# Supabase 登录邮件设置清单（约 10 分钟）

网站用 Supabase Auth 给学校邮箱发 6 位验证码。代码和数据库都已经配好了，下面这几步只能在 Supabase 控制台里手动完成。

- 项目：`biph-findmy`（新加坡）
- 控制台：<https://supabase.com/dashboard/project/vysbjwnojtbykmgmtrdo>
- 菜单名称可能和下面写的略有出入，找最接近的那一项就行。

> **为什么一定要配 SMTP**：Supabase 自带的发信服务**只能发给你 Supabase 组织里的成员**，而且每小时最多 2 封。不配 SMTP 的话，只有你自己能登录。

---

## 1. 验证码规则

**Authentication → Sign In / Providers → Email**

| 设置 | 值 |
|---|---|
| Enable Email provider | 开 |
| Confirm email | 开（默认） |
| Email OTP Expiration | `600`（秒，也就是 10 分钟，和网站上的提示一致） |
| Email OTP Length | `6` |

## 2. 邮件模板：改成显示验证码

**Authentication → Emails → Templates**

默认模板发的是登录链接，我们的网站要的是 6 位数字。**Magic Link** 和 **Confirm signup** 两个模板都要改：第一次登录的人会收到 Confirm signup，之后再登录收到的是 Magic Link。

**Subject（主题）：**

```
BIPH FindMy 登录验证码 · Your login code
```

**Body（正文，切到源码 / HTML 模式整段粘贴）：**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1b1f2a">
  <p style="font-size:16px;font-weight:600;margin:0">BIPH FindMy · 失物招领</p>
  <p style="font-size:15px;margin:20px 0 8px">你的登录验证码是 · Your login code is</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:8px 0 20px;color:#3245b7">{{ .Token }}</p>
  <p style="font-size:14px;color:#505667;margin:0 0 6px">验证码 10 分钟内有效。如果不是你本人操作，忽略这封邮件即可。</p>
  <p style="font-size:14px;color:#505667;margin:0">The code expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>
</div>
```

模板里故意不放链接和图片：一是不像钓鱼邮件，二是在校园网里也能正常显示。

## 3. SMTP：用你自己的邮箱发信

**Authentication → Emails → SMTP Settings → Enable custom SMTP**

下面任选一种。Sender name 填 `BIPH FindMy`；Sender email 必须和 SMTP 账号是同一个邮箱地址（Resend 除外）。

| 方式 | Host | Port | Username | Password | 说明 |
|---|---|---|---|---|---|
| **QQ 邮箱** | `smtp.qq.com` | `465` | 完整的 QQ 邮箱地址 | **授权码**，不是 QQ 密码 | 授权码在 QQ 邮箱 → 设置 → 账号 → 开启「POP3/SMTP 服务」后生成 |
| **163 邮箱** | `smtp.163.com` | `465` | 完整邮箱地址 | **授权码** | 设置 → POP3/SMTP/IMAP → 开启 SMTP 服务 |
| **Gmail** | `smtp.gmail.com` | `465` | Gmail 地址 | **应用专用密码** | 需要先开两步验证；每天约 500 封 |
| **Resend**（以后有域名时推荐） | `smtp.resend.com` | `465` | `resend` | Resend 的 API key | 需要先在 Resend 验证自己的域名；免费额度每天 100 封、每月 3000 封；发件人可以是 `noreply@你的域名` |

**建议**：最好专门注册一个社团用的邮箱来发信，不要用个人主邮箱。

## 4. 发信频率上限

**Authentication → Rate Limits**

所有登录请求都是从我们的服务器发给 Supabase 的，对 Supabase 来说全校的人共用同一组 IP，所以默认上限很容易被撞到。建议调成：

| 设置 | 建议值 |
|---|---|
| Rate limit for sending emails | `100` / 小时（不能超过你的 SMTP 服务商自己的上限） |
| Rate limit for sign ups and sign ins | 调到最大 |
| Rate limit for token verifications | 调到最大 |

## 5. 网站地址

**Authentication → URL Configuration → Site URL**：填 `https://biph-findmy.vercel.app`。以后绑了自定义域名，就改成新域名。

## 6. 用学校邮箱实测一次

有些学校邮箱会把新发件人直接隔离，所以**越早测越好**：

1. 打开 <https://biph-findmy.vercel.app/login>，输入学校邮箱（前提是你的学校邮箱域名已经加进允许列表，见下一节）。
2. 去收件箱、垃圾邮件和隔离区找验证码。
3. 如果被隔离了，请学校 IT 把发件邮箱加进白名单。

---

## 做完以后告诉我（或者自己在 Vercel 里改）

Vercel → biph-findmy → Settings → Environment Variables，下面两项改完要重新部署才生效：

| 变量 | 填什么 | 例子 |
|---|---|---|
| `ALLOWED_EMAIL_DOMAINS` | 允许登录的学校邮箱域名，多个用英文逗号分隔（学生和老师的可能不一样） | `school.example.com,students.school.example.com` |
| `ADMIN_EMAILS` | 管理员邮箱，比如前台老师和社团干部，他们可以看到管理后台和前台快速登记 | `desk@school.example.com,officer@school.example.com` |

这两项没填之前，线上网站**谁都登录不了**，这是故意设计的。不过不登录也能浏览物品。

### 可选：在 Supabase 这一层也限制域名

我们的后端已经会拒绝非学校邮箱。但 Supabase 的项目地址和公开 key 如果泄露了，别人可以绕过网站，直接调用 Supabase 给任意邮箱发验证码，白白消耗你的发信额度。等确定了学校域名，我会加一个 **Before User Created** hook，让 Supabase 自己拒绝非学校邮箱注册。到时候你只需要在 **Authentication → Hooks** 里把它打开。
