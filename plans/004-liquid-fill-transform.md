# 004 — 液面涨落从 height 动画改为 transform

- **Status**: DONE
- **Commit**: 0eb5a34
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 1 file（Cylinder3D.vue），script + style 各一处

## Problem

液面涨落动画的是 `height`——每帧触发 layout+paint，无法走合成器。同步完成后 N 个圆柱同时重算 800ms，低端手机可能掉帧。`transform` 是合成器友好属性，视觉可完全等价。

```js
// client/src/components/Cylinder3D.vue:60-63 — current
const liquidStyle = computed(() => ({
  height: `${Math.max(2, Math.min(100, props.progress))}%`,
  background: `linear-gradient(180deg, ${liquidColor.value.start} 0%, ${liquidColor.value.end} 100%)`
}))
```

```css
/* client/src/components/Cylinder3D.vue:184-193 — current */
.liquid-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  transition: height var(--duration-liquid) var(--ease-out);
  border-radius: 0 0 26% 26%;
  overflow: hidden;
  box-shadow: inset 0 8px 16px rgb(255 255 255 / 0.1);
}
```

## Target

`.liquid-fill` 固定 `height: 100%`，用 `translateY` 把它下沉 `(100 - progress)%`。父容器 `.liquid-area`（:174-182）已有 `overflow: hidden`，外层 `.cylinder-glass` 的 `overflow: hidden` + 底部圆角负责裁剪形状，液体底部溢出部分自然被裁掉，视觉不变。波浪（`top: -16px`）和 meniscus（`top: 0`）都锚定在 fill 顶部，随 translateY 一起移动，无需改。

```js
// target
const liquidStyle = computed(() => ({
  transform: `translateY(${100 - Math.max(2, Math.min(100, props.progress))}%)`,
  background: `linear-gradient(180deg, ${liquidColor.value.start} 0%, ${liquidColor.value.end} 100%)`
}))
```

```css
/* target */
.liquid-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  transition: transform var(--duration-liquid) var(--ease-out);
  border-radius: 0 0 26% 26%;
  overflow: hidden;
  box-shadow: inset 0 8px 16px rgb(255 255 255 / 0.1);
}
```

注意：`bottom: 0` 改为 `top: 0; bottom: 0`（占满容器高度），其余属性一字不动。

## Repo conventions to follow

- 动画时长/曲线沿用现有 token `var(--duration-liquid)`（800ms）、`var(--ease-out)`，只换属性。
- 组件内样式注释风格 `/* ---- xxx ---- */` 保持。

## Steps

1. `client/src/components/Cylinder3D.vue:60-63`：`liquidStyle` 的 `height` 键改为 `transform` 键（值见 Target，注意 `100 -` 反转）。
2. 同文件 `:184-193`：`.liquid-fill` 规则按 Target 修改（加 `top: 0`，`transition` 属性 height→transform）。

## Boundaries

- 不动波浪、meniscus、glass、rim 的任何样式。
- 不改 `--duration-liquid` 的值。
- 不在本计划里做"首载注水"（那是 006，依赖本计划完成）。

## Verification

- **Mechanical**: `cd client && npm run build` 成功。
- **Feel check**:
  - 各进度值（2%、30%、60%、90%、100%）下液面高度与改动前逐一对照（截图对比），底部圆角处液体不外溢、不缺角；
  - 触发一次同步（或在 DevTools 里改 progress prop），液面涨落动画仍是 800ms 平滑；
  - DevTools Performance 录制涨落过程：`.liquid-fill` 的动画帧不再出现 Layout（紫色）阶段。
- **Done when**: 静态渲染逐像素等价（人眼截图对比），动画期间无 layout 重排，涨落手感与之前一致。
