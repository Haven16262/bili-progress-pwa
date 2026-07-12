# 动画改进计划（improve-animations 审计产出）

审计基准 commit：`0eb5a34`（2026-07-12）。审计工具：`.claude/skills/improve-animations`（emilkowalski/skills）。
所有计划零上下文可执行：每份含现状代码原文、精确目标值、步骤、边界、验证（含 feel check）。

## 计划总表

| # | 计划 | 严重度 | 状态 |
|---|------|--------|------|
| 001 | [hover 位移/缩放加触屏门控](001-gate-hover-transforms.md) | HIGH | DONE |
| 002 | [模态框补退场动画](002-modal-exit-transitions.md) | MEDIUM | DONE |
| 003 | [reduced-motion 去位移留反馈](003-soften-reduced-motion.md) | MEDIUM | DONE |
| 004 | [液面 height→transform](004-liquid-fill-transform.md) | MEDIUM | DONE |
| 005 | [导航/列表补按压反馈](005-press-feedback.md) | LOW | DONE |
| 006 | [首载注水动画 + 数字 count-up](006-first-load-fill-up.md) | LOW（机会点） | DONE |
| 007 | [网格入场 stagger](007-grid-entrance-stagger.md) | LOW（机会点） | DONE |
| 008 | [删除未使用的 --ease-spring](008-remove-unused-spring-token.md) | LOW | DONE |

## 推荐执行顺序与依赖

```
001 → 003 → 002 → 004 → 005 → 006 → 007 → 008
```

- **006 依赖 004**（注水动画复用 transform 过渡机制），顺序不可换。
- **007 建议在 006 后**（入场 stagger 与注水视觉上组合，先有注水再调节奏）。
- **008 必须最后**（删 token 前需确认前序计划没有启用它）。
- 001/002/003/005 相互独立，可任意穿插，但 003 改的是全局媒体查询，先做可让后续计划的 reduced-motion 验证项直接生效。

## 执行约定

- 每份计划完成后在本表更新状态（TODO → DONE / SKIPPED），并在计划文件头部同步 Status。
- 计划步骤与实际代码不符（commit 漂移）时：停下报告，不要即兴改。
- 执行者不得超出计划 Boundaries 一节的范围。
