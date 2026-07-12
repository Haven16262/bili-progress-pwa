# 008 — 删除未使用的 --ease-spring token

- **Status**: DONE
- **Commit**: 0eb5a34
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file 1 行

## Problem

```css
/* client/src/assets/styles/main.css:78 — current */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

定义后全库零使用（`grep -rn "ease-spring" client/src client/tailwind.config.js` 仅命中定义行）。死 token 会误导后来者以为项目里有弹性动画体系。

## Target

删除该行。

## Steps

1. 先跑 `grep -rn "ease-spring" client/` 重新确认仍然只有定义行（001-007 的执行者理论上不会用它，但要验证）。
2. 若确认零使用：删除 `main.css:78` 一行。
3. 若有计划用了它：把本计划标记为 SKIPPED 并在 plans/README.md 注明，不删。

## Boundaries

- 只删这一行，不动 `--ease-out` / `--ease-in-out`。

## Verification

- **Mechanical**: `grep -rn "ease-spring" client/` 零命中；`cd client && npm run build` 成功。
- **Done when**: token 已删且构建通过。
