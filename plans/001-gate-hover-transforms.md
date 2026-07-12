# 001 — 用 hover 媒体查询门控所有 :hover 位移/缩放

- **Status**: DONE
- **Commit**: 0eb5a34
- **Severity**: HIGH
- **Category**: Accessibility(触屏 false hover)
- **Estimated scope**: 4 files, CSS only, ~40 行改动

## Problem

这是触屏优先的 PWA。触屏设备上 tap 会触发 `:hover` 并**粘住**（直到点击别处），所以手机上点一下圆柱它会"浮起"卡住、点导航图标它会保持放大。所有带 `transform` 的 hover 规则都没有 `@media (hover: hover)` 门控。

现状（4 处，全部逐字核对过）：

```css
/* client/src/components/Cylinder3D.vue:83 — current */
.cylinder-wrapper:hover {
  transform: translateY(-3px);
}
```

```css
/* client/src/components/BottomNav.vue:98 — current */
.nav-link:hover .nav-icon {
  transform: scale(1.1);
}
```

```css
/* client/src/views/HomePage.vue:318 — current */
.home-header__add-btn:hover {
  background: var(--color-accent-hover);
  transform: scale(1.08);
  box-shadow: 0 4px 16px rgb(6 182 212 / 0.35);
}
```

```css
/* client/src/views/HomePage.vue:415 — current */
.home-empty__btn:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
}
```

```css
/* client/src/components/PasswordGate.vue:127 — current */
.gate-card__btn:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
}
```

## Target

每条含 `transform` 的 hover 规则包进 `@media (hover: hover) and (pointer: fine)`。**颜色/阴影部分保留在媒体查询内一起搬**（整条规则搬进去，不拆分——触屏上背景色粘住同样是残留态）。示例：

```css
/* target */
@media (hover: hover) and (pointer: fine) {
  .cylinder-wrapper:hover {
    transform: translateY(-3px);
  }
}
```

Cylinder3D 的连带 hover 规则（`.cylinder-wrapper:hover .cylinder-glass` :128、`.cylinder-wrapper:hover .hover-glow` :272、`.cylinder-wrapper:hover .cylinder-label` :305）也一并搬进同一个媒体查询块——它们是同一个悬浮效果的组成部分。

BottomNav 的纯颜色 hover（`.nav-link:hover` :71、`.nav-link--active:hover` :86）和 AddVideoModal 的纯颜色 hover **不动**——本计划只处理产生位移/缩放/发光残留的规则。

## Repo conventions to follow

- 样式写在各 `.vue` 文件的 `<style scoped>` 内，纯 CSS 无预处理器。
- 动画值一律用 token：`var(--duration-fast)` / `var(--ease-out)`（定义在 `client/src/assets/styles/main.css:70-78`）。本计划不新增值，只搬移。

## Steps

1. `client/src/components/Cylinder3D.vue`：新建 `@media (hover: hover) and (pointer: fine) { ... }` 块，将 `:83-85`（wrapper hover）、`:128-134`（glass hover）、`:272-274`（hover-glow）、`:305-307`（label hover）四条规则整体移入。`:active` 规则（:96-98）**留在媒体查询外**——按压反馈触屏也要有。
2. `client/src/components/BottomNav.vue`：将 `:98-100`（`.nav-link:hover .nav-icon`）移入同样的媒体查询块。
3. `client/src/views/HomePage.vue`：将 `:318-322`（add-btn hover）、`:415-418`（empty-btn hover）移入媒体查询块（同文件可共用一个块）。
4. `client/src/components/PasswordGate.vue`：将 `:127-130`（gate-card__btn hover）移入媒体查询块。

## Boundaries

- 只搬移规则位置，**不改任何属性值**。
- 不动 `:active`、`:focus-visible` 规则。
- 不动 SettingsPage、AddVideoModal（无 transform hover）。
- 若某行号处代码与上面摘录不符（commit 漂移），停下报告，不要即兴改。

## Verification

- **Mechanical**: `cd client && npm run build` 成功，无新警告。
- **Feel check**: DevTools 切到手机模拟（touch 模式）：tap 圆柱后它**不再保持浮起**；tap 底部导航图标后图标不再卡在放大态。切回桌面鼠标模式：hover 效果全部照旧。
- **Done when**: touch 模拟下 tap 任意可点元素，松手后无残留的位移/缩放/发光态；桌面 hover 行为与改动前逐项一致。
