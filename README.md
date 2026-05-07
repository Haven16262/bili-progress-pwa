# Bili Progress

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](./CHANGELOG.md)

Bilibili 观看进度 3D 可视化 PWA。通过圆柱体高度直观展示所有追番/追剧的观看进度，支持自动同步 B 站观看历史。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite + Tailwind CSS + Three.js |
| 后端 | Express.js (Node.js) |
| 数据库 | SQLite (better-sqlite3) |
| 认证 | JWT + 应用密码 |
| 安全 | Helmet / HSTS / CSP / 速率限制 / AES-256-GCM |
| PWA | vite-plugin-pwa + Workbox |

## 快速开始

```bash
# 1. 安装依赖
cd server && npm install
cd ../client && npm install

# 2. 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env，填写 APP_PASSWORD 和 JWT_SECRET

# 3. 开发模式
# 终端 1 — 后端 (端口 3000)
cd server && npm run dev
# 终端 2 — 前端 (端口 5173)
cd client && npm run dev

# 4. 生产构建
cd client && npm run build
cd ../server && npm start  # 静态托管 client/dist
```

## 环境变量

| 变量 | 说明 | 必填 |
|---|---|---|
| `PORT` | 服务端口，默认 3000 | 否 |
| `APP_PASSWORD` | 登录密码 | 是 |
| `JWT_SECRET` | JWT 签名密钥（随机生成） | 是 |

```bash
# 生成 JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 功能

- **3D 圆柱体可视化** — 每部视频一个圆柱体，高度 = 观看百分比，颜色越绿越接近看完
- **B 站历史同步** — 填写 SESSDATA Cookie 后自动拉取在看视频列表
- **多 P 支持** — 分 P 视频按集数加权计算整体进度
- **自定义名称** — 点击圆柱体编辑视频的显示名称
- **置顶 / 归档** — 追完归档，正在追的可置顶
- **每日自动同步** — cron 定时拉取最新进度
- **PWA** — 可安装到桌面，离线可用
- **安全设计** — 密码登录、JWT 鉴权、SESSDATA 加密存储、令牌吊销

## 项目结构

```
├── client/                  # Vue 3 前端
│   ├── src/
│   │   ├── components/      # Cylinder3D / PasswordGate / BottomNav / AddVideoModal
│   │   ├── views/           # HomePage / SettingsPage
│   │   └── services/        # API 封装
│   └── vite.config.js       # PWA + 代理配置
├── server/                  # Express 后端
│   ├── src/
│   │   ├── routes/          # auth / videos / sync / settings / bilibili
│   │   ├── services/        # bilibili API / crypto / sync
│   │   ├── middleware/      # JWT 认证
│   │   └── db/              # SQLite 初始化 + 查询
│   ├── .env.example         # 环境变量模板
│   └── backup.sh            # 数据库备份脚本
├── .github/                 # Issue 模板
├── LICENSE
├── CHANGELOG.md
├── CONTRIBUTING.md
└── .gitignore
```

## 截图

> 部署后可在设置页配置 SESSDATA，主页展示 3D 进度圆柱体。

## 相关文件

- [CHANGELOG.md](./CHANGELOG.md) — 版本变更记录
- [CONTRIBUTING.md](./CONTRIBUTING.md) — 贡献指南
- [server/.env.example](./server/.env.example) — 环境变量模板
- [server/backup.sh](./server/backup.sh) — 数据库备份脚本

## 许可

[MIT](./LICENSE)
