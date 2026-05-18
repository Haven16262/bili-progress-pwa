# Changelog

All notable changes to Bili Progress PWA.

## [1.1.0] — 2026-05-18

### Added
- 三设备独立列数设置：手机 / 平板 / 桌面各自用 localStorage 存储，互不影响
- 手机端圆柱体固定尺寸，不再随网格列宽缩放，保证同屏大小一致

### Fixed
- 手机竖屏圆柱体大小不一致（网格行高 auto 撑开导致）
- 手机横屏 / 平板无法上下滑动（min-h-screen 导致 overflow-auto 失效，改为 h-screen）
- 手机端圆柱体名称横屏下被截断（纵向滚动恢复后自然显示）

## [1.0.0] — 2025-05-06

### Added
- 3D 圆柱体可视化，高度映射观看百分比，颜色从红到绿
- B 站历史同步，通过 SESSDATA Cookie 拉取在看列表
- 多 P 视频支持，按集数加权计算整体进度
- 圆柱体点击编辑自定义显示名称
- 置顶/归档功能管理追番列表
- 每日 03:07 自动同步 (node-cron)
- PWA 支持，可安装到桌面，离线可用
- JWT + 应用密码双因子认证
- SESSDATA AES-256-GCM 加密存储
- 令牌版本号吊销机制
- Helmet 安全头 (CSP / HSTS / Referrer-Policy)
- 速率限制 (120 req/min)
- 分 P 缓存，减少 B 站 API 调用
- 同步状态通知与底部导航红点提示
- Favicon 及多尺寸 PWA 图标
