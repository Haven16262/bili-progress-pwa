# 003 — reduced-motion 从"全灭"改为"去位移、留反馈"

- **Status**: DONE
- **Commit**: 0eb5a34
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file（main.css），~15 行

## Problem

当前 reduced-motion 是核弹式一刀切，连帮助理解状态的 opacity/颜色过渡也全部杀掉（按钮 hover 变色、模态遮罩淡入都变成 0.01ms 硬切）。规范是"更少、更柔，不是零"——应去掉位移类动画，保留不引起晕动的反馈。

```css
/* client/src/assets/styles/main.css:107-113 — current */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Target

```css
/* target — 完整替换上面的块 */
@media (prefers-reduced-motion: reduce) {
  /* 位移类 keyframes（入场滑入、水波旋转）直接跳过 */
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
  /* 过渡只允许非位移属性：颜色/透明度/阴影反馈保留原时长 */
  *, *::before, *::after {
    transition-property: opacity, color, background-color, border-color, box-shadow !important;
  }
}
```

效果：transform/height 过渡被排除出 `transition-property`（液面、hover 位移、按压缩放全部瞬时到位），而 opacity/颜色反馈保持原有 150-300ms 节奏。

## Repo conventions to follow

- 全局样式集中在 `client/src/assets/styles/main.css`，分段注释风格 `/* ---- xxx ---- */` 与 `/* ==== 段落标题 ==== */`，替换时保留原有的段落标题注释（`Reduced-motion` 段，:103-105），更新注释文字为新语义。

## Steps

1. `client/src/assets/styles/main.css:107-113`：整块替换为 Target 代码，并把 :104 的注释 `disable all non-essential animation` 改为 `drop movement, keep opacity/color feedback`。

## Boundaries

- 只动这一个媒体查询块，不动任何组件样式。
- 不为单个组件写例外规则（有需要是后续计划的事）。

## Verification

- **Mechanical**: `cd client && npm run build` 成功。
- **Feel check**: DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`：
  - 水波不再旋转、圆柱 hover 不再位移（瞬时）；
  - 按钮 hover 变色**仍有平滑过渡**，模态遮罩淡入淡出**仍在**；
  - 液面高度变化瞬时到位（无 800ms 动画）。
- **Done when**: reduced-motion 下位移动画全部消失、颜色/透明度过渡全部保留。
