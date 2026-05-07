# Contributing

感谢你对 Bili Progress 的关注！本项目目前为个人项目，但欢迎提交 issue 和 PR。

## 提交 Issue

- 使用 Bug Report 或 Feature Request 模板
- 提供可复现的步骤和环境信息
- 安全问题请勿公开提交，直接联系维护者

## 提交 Pull Request

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feat/your-feature`)
3. 遵守现有代码风格（ESLint + Prettier 如已配置）
4. 提交前确保功能正常：`cd server && npm run dev` 和 `cd client && npm run dev`
5. 提交简洁的 commit message（参考 [Conventional Commits](https://www.conventionalcommits.org/)）
6. Push 并创建 PR

## 本地开发

```bash
# 后端 (端口 3000)
cd server
cp .env.example .env    # 编辑 .env 填入必要配置
npm install
npm run dev

# 前端 (端口 5173)
cd client
npm install
npm run dev
```

## 代码风格

- 使用 ES modules (`import`/`export`)
- 命名: 变量/函数 `camelCase`，组件 `PascalCase`
- 优先不可变数据模式
- 尽早返回，减少嵌套

## 许可

提交代码即表示同意在 MIT 许可下分发。
