# 006 — 首次加载的"注水"动画 + 进度数字 count-up

- **Status**: DONE
- **Commit**: 0eb5a34
- **Severity**: LOW（加分项/机会点）
- **Category**: Missed opportunity（低频愉悦时刻）
- **Estimated scope**: 1 file（Cylinder3D.vue），script + template

## Problem

液面高度目前在挂载时直接渲染到位——产品的招牌视觉（玻璃圆柱注水）在最该出彩的首屏时刻是静止的。每次访问只发生一次，正属于"可以给愉悦感"的低频时刻。配套地，进度数字也可以从 0 数到实际值。

前提：004 已把液面改为 `transform: translateY((100-p)%)` + `transition: transform var(--duration-liquid) var(--ease-out)`。

## Target

挂载时液面从 0%（`translateY(100%)`）开始，下一帧切到实际进度，浏览器用现成的 800ms transition 完成注水。数字用 rAF 从 0 计数到实际值，与注水同步（800ms、同样的 ease-out 手感）。`prefers-reduced-motion` 时两者都直接显示最终值。

```js
// target — Cylinder3D.vue <script setup> 追加
import { computed, ref, onMounted, onUnmounted } from 'vue'

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const FILL_DURATION_MS = 800  // 与 --duration-liquid 一致

const isFilled = ref(REDUCED_MOTION)        // reduced-motion 直接到位
const displayProgress = ref(REDUCED_MOTION ? undefined : 0)
let rafId = 0

onMounted(() => {
  if (REDUCED_MOTION) return
  requestAnimationFrame(() => {
    isFilled.value = true
    const start = performance.now()
    const target = Math.round(Math.max(0, Math.min(100, props.progress)))
    const tick = (now) => {
      const t = Math.min(1, (now - start) / FILL_DURATION_MS)
      const eased = 1 - Math.pow(1 - t, 3)   // cubic ease-out，与 --ease-out 手感一致
      displayProgress.value = Math.round(target * eased)
      if (t < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  })
})

onUnmounted(() => cancelAnimationFrame(rafId))
```

```js
// target — liquidStyle 改为受 isFilled 控制
const liquidStyle = computed(() => {
  const p = isFilled.value ? Math.max(2, Math.min(100, props.progress)) : 0
  return {
    transform: `translateY(${100 - p}%)`,
    background: `linear-gradient(180deg, ${liquidColor.value.start} 0%, ${liquidColor.value.end} 100%)`
  }
})
```

```html
<!-- target — 进度数字 -->
<div class="progress-text">{{ displayProgress ?? Math.round(progress) }}%</div>
```

注意：`isFilled` 变 true 后，后续 `props.progress` 的正常变化（同步更新）走同一个 computed，行为与 004 之后一致，不受影响。count-up 只在挂载时跑一次；之后数字直接跟 `props.progress`——所以 tick 结束时把 `displayProgress.value = undefined`，让模板回落到实时值。

## Repo conventions to follow

- 组件是 `<script setup>` + `defineProps`/`computed` 风格（见现有 Cylinder3D.vue:37-63），新代码保持同风格。
- 时长复用 800ms（`--duration-liquid`），JS 侧用常量注明对应关系。

## Steps

1. 004 合入后再开始。
2. `client/src/components/Cylinder3D.vue`：按 Target 改 script（imports、状态、onMounted/onUnmounted、liquidStyle、tick 结束回落 undefined）。
3. 模板 `:23` 的 `{{ Math.round(progress) }}%` 改为 `{{ displayProgress ?? Math.round(progress) }}%`。

## Boundaries

- 只动 Cylinder3D.vue。
- 不改 CSS（004 的 transition 直接复用）。
- 不做 IntersectionObserver 之类"进入视口才注水"的增强（YAGNI）。
- 若 004 未合入（`.liquid-fill` 还在用 height），停下报告。

## Verification

- **Mechanical**: `cd client && npm run build` 成功。
- **Feel check**:
  - 刷新首页：所有圆柱从空杯注水到各自进度，约 0.8s，数字同步从 0 数到位，结束后数字与液面停在同一节拍（无数字先到/后到的脱节感）;
  - 注水结束后触发同步改变 progress：液面正常过渡，数字瞬时更新（预期行为）；
  - Rendering 面板开 reduced-motion 后刷新：液面和数字直接到位，无动画。
- **Done when**: 首载有注水动画，reduced-motion 下无动画，后续 progress 更新行为与 004 后一致，组件卸载无 rAF 泄漏（onUnmounted 已 cancel）。
