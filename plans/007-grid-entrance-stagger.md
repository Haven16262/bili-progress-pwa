# 007 — 圆柱网格入场 stagger

- **Status**: DONE
- **Commit**: 0eb5a34
- **Severity**: LOW（加分项/机会点）
- **Category**: Cohesion（群组入场）
- **Estimated scope**: 1 file（HomePage.vue），template + style

## Problem

数据加载完成后整片圆柱网格同时弹出（无入场动画）。群组入场应该有 30-80ms 的 stagger——装饰性的、绝不阻塞交互。

```html
<!-- client/src/views/HomePage.vue:58-69 — current（移动端分支；桌面分支 :72-81 结构相同） -->
<div v-else-if="isMobile" class="home-grid-scroll">
  <div class="grid gap-3" :style="gridStyle" style="width: max-content">
    <Cylinder3D
      v-for="video in videos"
      :key="video.id"
      ...
    />
```

## Target

每个圆柱带 `fade-in` 入场（tailwind.config.js 已有现成 keyframes：`fade-in` = translateY(8px)+opacity，300ms `--ease-out`），按索引错开 40ms，**封顶第 10 个**（此后全部同一延迟，总长 < 800ms，不让长列表拖尾）：

```html
<!-- target — 两个分支的 v-for 都加 -->
<Cylinder3D
  v-for="(video, i) in videos"
  :key="video.id"
  class="animate-fade-in cylinder-stagger"
  :style="{ '--stagger': Math.min(i, 10) }"
  ...
/>
```

```css
/* target — HomePage.vue <style scoped> 追加 */
.cylinder-stagger {
  opacity: 0;
  animation-delay: calc(var(--stagger) * 40ms);
}
```

`opacity: 0` 起始 + `forwards` 填充（tailwind 的 animation 定义已带 `forwards`，见 tailwind.config.js:63）保证延迟期间不闪现。

## Repo conventions to follow

- 入场 keyframes 用现成的 tailwind `animate-fade-in`（tailwind.config.js:48-66），不新造 keyframes。
- Vue 组件上加 class/style 会落到 Cylinder3D 根元素（`<button class="cylinder-wrapper">`），无需改 Cylinder3D 本身。

## Steps

1. `client/src/views/HomePage.vue`：两个网格分支（:58 移动端、:72 桌面端）的 `v-for` 改为 `(video, i)`，按 Target 加 class 和 `--stagger` 变量。
2. `<style scoped>` 追加 `.cylinder-stagger` 规则。

## Boundaries

- 只动 HomePage.vue 的网格分支。
- stagger 是装饰——不得用 JS 延迟数据渲染，动画期间圆柱必须可点击。
- 不给空状态/设置页加 stagger。
- 与 006 组合时不改 006 的注水时序（各自独立跑，视觉上自然叠加）。

## Verification

- **Mechanical**: `cd client && npm run build` 成功。
- **Feel check**:
  - 刷新首页：圆柱从左到右依次浮现（40ms 间隔），第 10 个之后同时出现，无拖尾感;
  - 动画进行中立即点击最后一个圆柱：改名模态正常打开（不阻塞交互）；
  - reduced-motion 下（003 已合入时）：keyframes 被 0.01ms 跳过，网格直接全部显示，**确认不会因 `opacity: 0` 起始而卡在不可见**（0.01ms + forwards 会立即落到 100% 帧，应正常；若发现不可见，停下报告）。
- **Done when**: 入场有节奏感、无交互阻塞、reduced-motion 下全部立即可见。
