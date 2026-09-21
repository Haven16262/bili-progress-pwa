<template>
  <button
    ref="rootEl"
    class="cylinder-wrapper"
    :class="{ 'is-complete': isComplete, 'is-celebrating': celebrating }"
    @click="$emit('click')"
    :aria-label="`${displayName} — 进度 ${Math.round(progress)}%`"
  >
    <!-- Liquid-color bloom behind the cup (cheap radial, no backdrop-filter — T7) -->
    <div class="cup-bloom" :style="bloomStyle" aria-hidden="true"></div>

    <!-- 100% 庆祝：杯外光环 + 绕杯亮弧（在杯子后面；静态态亮弧 opacity 0） -->
    <template v-if="isComplete">
      <div class="cup-halo" aria-hidden="true"></div>
      <div class="cup-arc" aria-hidden="true"></div>
    </template>

    <!-- Glass cylinder -->
    <div class="cylinder-glass">
      <!-- Back rim of top opening -->
      <div class="top-rim-back"></div>

      <!-- Liquid fill area -->
      <div class="liquid-area">
        <div class="liquid-fill" :style="liquidStyle">
          <!-- Wave layers at liquid surface -->
          <div class="wave" :style="{ animationDuration: '4s' }"></div>
          <div class="wave wave-2" :style="{ animationDuration: '6s' }"></div>
          <!-- Meniscus — bright tension line at liquid surface -->
          <div class="meniscus"></div>
        </div>
      </div>

      <!-- Glass highlight / reflection -->
      <div class="glass-shine"></div>

      <!-- Progress number -->
      <div class="progress-text">{{ displayProgress ?? Math.round(progress) }}%</div>

      <!-- Front rim of top opening -->
      <div class="top-rim"></div>

      <!-- Hover glow ring -->
      <div class="hover-glow"></div>
    </div>

    <!-- Bottom label -->
    <span class="cylinder-label" :title="fullTitle">{{ displayName }}</span>
  </button>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { hasCelebrated, markCelebrated } from '../utils/celebrated.js'

defineEmits(['click'])

const props = defineProps({
  progress: { type: Number, default: 0 },
  customName: { type: String, default: '' },
  fullTitle: { type: String, default: '' },
  videoId: { type: [Number, String], default: null }
})

// First-load fill-up animation state
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const FILL_DURATION_MS = 800  // matches --duration-liquid
const CELEBRATION_MS = 3600   // 与 CSS --duration-celebrate 一致（用户 2026-09-21：整体放慢 1.2×）
const STAGGER_MS = 40         // 与 HomePage .cylinder-stagger 的 animation-delay 步长一致

const rootEl = ref(null)
const isFilled = ref(REDUCED_MOTION)  // skip animation when reduced-motion
const displayProgress = ref(REDUCED_MOTION ? undefined : 0)
let rafId = 0

const isComplete = computed(() => props.progress >= 100)
const celebrating = ref(false)
let startTimer = 0
let endTimer = 0

function startCelebration() {
  if (REDUCED_MOTION || !isComplete.value) return
  if (hasCelebrated(props.videoId)) return
  // 存储不可用（隐私模式等）→ 不播：否则每次刷新都会重播
  if (!markCelebrated(props.videoId)) return
  celebrating.value = true
  clearTimeout(endTimer)
  endTimer = setTimeout(() => { celebrating.value = false }, CELEBRATION_MS + 60)
}

// 等注水 + 数字 count-up 跑完（800ms）再起播；首次加载时还要加上该卡片的入场 stagger 延迟
function scheduleCelebration(delayMs = 0) {
  if (REDUCED_MOTION || !isComplete.value) return
  const stagger = parseInt(getComputedStyle(rootEl.value).getPropertyValue('--stagger'), 10) || 0
  clearTimeout(startTimer)
  startTimer = setTimeout(startCelebration, FILL_DURATION_MS + stagger * STAGGER_MS + 100 + delayMs)
}

// 手动「标记为已看完」：progress 由 <100 变成 >=100（弹窗已关，杯子注满后起播）
watch(() => props.progress, (now, before) => {
  if (now >= 100 && before < 100) scheduleCelebration()
})

onMounted(() => {
  if (isComplete.value) scheduleCelebration()

  if (REDUCED_MOTION) return
  requestAnimationFrame(() => {
    isFilled.value = true
    const start = performance.now()
    const target = Math.round(Math.max(0, Math.min(100, props.progress)))
    const tick = (now) => {
      const t = Math.min(1, (now - start) / FILL_DURATION_MS)
      const eased = 1 - Math.pow(1 - t, 3)  // cubic ease-out, matches --ease-out
      displayProgress.value = Math.round(target * eased)
      if (t < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        displayProgress.value = undefined  // fall back to live value
      }
    }
    rafId = requestAnimationFrame(tick)
  })
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  clearTimeout(startTimer)
  clearTimeout(endTimer)
})

const displayName = computed(() => props.customName || props.fullTitle || '未命名')

// Color shifts from cyan (low) → blue → violet → purple (high)
// Token names defined in main.css: --liquid-{cyan,blue,violet,purple}-{start,end,bloom}
const liquidColor = computed(() => {
  const p = Math.max(0, Math.min(100, props.progress))
  if (p < 30) return {
    start: 'var(--liquid-cyan-start)', end: 'var(--liquid-cyan-end)', bloom: 'var(--liquid-cyan-bloom)'
  }
  if (p < 60) return {
    start: 'var(--liquid-blue-start)', end: 'var(--liquid-blue-end)', bloom: 'var(--liquid-blue-bloom)'
  }
  if (p < 90) return {
    start: 'var(--liquid-violet-start)', end: 'var(--liquid-violet-end)', bloom: 'var(--liquid-violet-bloom)'
  }
  return {
    start: 'var(--liquid-purple-start)', end: 'var(--liquid-purple-end)', bloom: 'var(--liquid-purple-bloom)'
  }
})

const liquidStyle = computed(() => {
  const p = isFilled.value ? Math.max(2, Math.min(100, props.progress)) : 0
  return {
    transform: `translateY(${100 - p}%)`,
    background: `linear-gradient(180deg, ${liquidColor.value.start} 0%, ${liquidColor.value.end} 100%)`
  }
})

const bloomStyle = computed(() => ({
  background: `radial-gradient(circle, ${liquidColor.value.bloom}, transparent 70%)`
}))
</script>

<style scoped>
/* ---- Wrapper — <button> for native focus & a11y ---- */
.cylinder-wrapper {
  position: relative; /* anchor for .cup-bloom */
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 8px 4px;
  background: none;
  border: none;
  cursor: pointer;
  font: inherit;
  color: inherit;
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--duration-fast) var(--ease-out);
}

/* ---- Cup bloom — radial glow in the liquid color behind the glass ---- */
.cup-bloom {
  position: absolute;
  left: 50%;
  top: 35%; /* ≈40% of glass height (wrapper includes the label below) */
  width: 130px;
  height: 130px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  filter: blur(6px);
  pointer-events: none;
}

@media (hover: hover) and (pointer: fine) {
  .cylinder-wrapper:hover {
    transform: translateY(-3px);
  }
}

.cylinder-wrapper:focus-visible {
  outline: none;
}

.cylinder-wrapper:focus-visible .cylinder-glass {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}

.cylinder-wrapper:active {
  transform: translateY(-1px) scale(0.98);
}

/* ---- Glass cylinder body — translucent wall, no backdrop-filter (T7) ---- */
.cylinder-glass {
  position: relative;
  width: 100%;
  aspect-ratio: 0.55 / 1;
  max-width: 120px;
  border: 1px solid rgb(255 255 255 / 0.3);
  border-top: none;
  border-radius: 4px 4px 26px 26px;
  background: linear-gradient(
    90deg,
    rgb(255 255 255 / 0.10) 0%,
    rgb(255 255 255 / 0.03) 25%,
    rgb(255 255 255 / 0.01) 50%,
    rgb(255 255 255 / 0.03) 75%,
    rgb(255 255 255 / 0.10) 100%
  );
  box-shadow:
    inset 0 0 20px rgb(0 0 0 / 0.25),
    0 4px 16px rgb(0 0 0 / 0.3);
  overflow: hidden;
  transition:
    box-shadow var(--duration-normal) var(--ease-out),
    border-color var(--duration-normal) var(--ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .cylinder-wrapper:hover .cylinder-glass {
    box-shadow:
      inset 0 0 20px rgb(0 0 0 / 0.25),
      0 4px 16px rgb(0 0 0 / 0.3),
      0 0 24px rgb(34 211 238 / 0.12);
    border-color: rgb(255 255 255 / 0.55);
  }
}

/* ---- Top rim (front — above liquid) ---- */
.top-rim {
  position: absolute;
  top: -1px;
  left: -1px;
  right: -1px;
  height: 16%;
  max-height: 22px;
  border: 1px solid rgb(255 255 255 / 0.45);
  border-bottom: 1px solid rgb(255 255 255 / 0.25);
  border-radius: 50%;
  /* Rim highlight: subtle bright spot offset-left, mimicking light source */
  background: radial-gradient(
    ellipse at 35% 55%,
    rgb(255 255 255 / 0.3) 0%,
    rgb(255 255 255 / 0.12) 30%,
    rgb(255 255 255 / 0.04) 60%,
    rgb(255 255 255 / 0.1) 100%
  );
  z-index: 4;
}

/* ---- Top rim (back — behind liquid) ---- */
.top-rim-back {
  position: absolute;
  top: -1px;
  left: -1px;
  right: -1px;
  height: 16%;
  max-height: 22px;
  border: 1px solid rgb(255 255 255 / 0.35);
  border-bottom: 1px solid rgb(255 255 255 / 0.2);
  border-radius: 50%;
  background: rgb(255 255 255 / 0.08);
  z-index: 2;
}

/* ---- Liquid fill ---- */
.liquid-area {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  top: 8%;
  overflow: hidden;
  z-index: 1;
}

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

/* ---- Meniscus — bright tension line at liquid surface ---- */
.meniscus {
  position: absolute;
  top: 0;
  left: 4%;
  right: 4%;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgb(255 255 255 / 0.25) 15%,
    rgb(255 255 255 / 0.08) 50%,
    rgb(255 255 255 / 0.25) 85%,
    transparent 100%
  );
  z-index: 2;
  pointer-events: none;
}

/* ---- Wave animation (Plan C: original rotate) ---- */
.wave {
  position: absolute;
  top: -16px;
  left: -50%;
  width: 200%;
  height: 32px;
  background: rgb(255 255 255 / 0.15);
  border-radius: 42% 48% 44% 46%;
  animation: wave-spin linear infinite;
  opacity: 0.7;
}

.wave-2 {
  top: -12px;
  height: 24px;
  animation-direction: reverse;
  opacity: 0.4;
  border-radius: 46% 42% 48% 44%;
}

@keyframes wave-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* ---- Glass highlight / reflection ---- */
.glass-shine {
  position: absolute;
  top: 12%;
  bottom: 8%;
  left: 18%;
  width: 14%;
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 0.12) 0%,
    rgb(255 255 255 / 0.04) 50%,
    rgb(255 255 255 / 0.08) 100%
  );
  border-radius: 40%;
  z-index: 3;
  pointer-events: none;
}

/* ---- Hover glow ring ---- */
.hover-glow {
  position: absolute;
  inset: -4px;
  border-radius: 0 0 30% 30%;
  opacity: 0;
  pointer-events: none;
  z-index: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
  box-shadow:
    inset 0 0 12px rgb(6 182 212 / 0.06),
    0 0 20px rgb(6 182 212 / 0.04);
}

@media (hover: hover) and (pointer: fine) {
  .cylinder-wrapper:hover .hover-glow {
    opacity: 1;
  }
}

/* ---- Progress text — Manrope 700 per 视觉稿 ---- */
.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--font-display);
  font-size: clamp(12px, 16%, 18px);
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 6px rgb(0 0 0 / 0.4);
  z-index: 5;
  pointer-events: none;
  white-space: nowrap;
}

/* ================================================================
   100% 庆祝（plan 009 · A+C 蓝紫→兰紫）
   数值同 plans/celebrate-100/reference-A+C-gradient.dc.html：
   参考稿是 6s 预览循环，这里把 halo-burst / arc-burst / sheen 三组关键帧
   百分比整体 ×2 压成「一次 3s」（iteration-count 1，无 fill-mode → 回落到静态终态）；
   *-once 版本来就是 3s，直接用于悬停重放。
   ================================================================ */

@property --ang {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

/* ---- 杯外光环 / 绕杯亮弧（DOM 在杯子之前 = 视觉在杯后） ----
   参考稿是 200×300 / 遮罩 60%→74%；这里整体缩到 92%（184×276）并把遮罩百分比
   按同比例反算成 65%→80%，使**环带的绝对位置与参考稿逐点一致**，只收窄外侧渐隐区
   —— 手机端横向滚动容器（.home-grid-scroll）会裁切超出列宽的部分，缩这一圈
   是为了让裁切线落在渐隐区里、不切成硬边（实测见交接块）。 */
.cup-halo,
.cup-arc {
  position: absolute;
  left: 50%;
  top: 44%;
  width: 184px;
  height: 276px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  -webkit-mask-image: radial-gradient(closest-side, transparent 65%, #000 80%, transparent 100%);
  mask-image: radial-gradient(closest-side, transparent 65%, #000 80%, transparent 100%);
  pointer-events: none;
}

.cup-halo {
  background: var(--celebrate-halo);
  filter: blur(7px);
  opacity: 0.32;
}

/* 静态态：亮弧必须完全不可见（只依赖 @property --ang 的浏览器降级时也不能留常驻弧） */
.cup-arc {
  background: var(--celebrate-arc);
  filter: blur(4px);
  opacity: 0;
}

/* ---- 数字：静态终态 = 淡紫渐变（提亮后的停点，对杯中列 ≥3:1） ---- */
.cylinder-wrapper.is-complete .progress-text {
  font-size: 16px;
  padding: 0 2px;
  background: var(--celebrate-sheen), var(--celebrate-text-base);
  background-size: 250% 100%, 100% 100%;
  background-repeat: no-repeat;
  background-position: 150% 0, 0 0;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  text-shadow: none;
  /* 静态终态不带柔光（用户反馈笔画发虚）：只留深紫描边 + 黑影，柔光只在庆祝/悬停时出现 */
  filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.5)) var(--celebrate-outline) var(--celebrate-glow-none);
}

/* ---- 首次庆祝（3s，一次性） ---- */
.cylinder-wrapper.is-celebrating .cup-halo {
  animation: celebrate-halo-burst var(--duration-celebrate) ease-out 1;
}

.cylinder-wrapper.is-celebrating .cup-arc {
  animation: celebrate-arc-burst var(--duration-celebrate) linear 1;
}

.cylinder-wrapper.is-celebrating .progress-text {
  animation: celebrate-sheen var(--duration-celebrate) ease-in-out 1;
}

@keyframes celebrate-halo-burst {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.74); }
  40% { opacity: 0.85; }
  100% { opacity: 0.32; transform: translate(-50%, -50%) scale(1); }
}

@keyframes celebrate-arc-burst {
  0% { opacity: 0; --ang: 0deg; }
  16% { opacity: 1; }
  88% { opacity: 1; --ang: 360deg; }
  100% { opacity: 0; --ang: 360deg; }
}

@keyframes celebrate-sheen {
  0% {
    background-position: 150% 0, 0 0;
    transform: translate(-50%, -50%) scale(1);
    filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.5)) var(--celebrate-outline) var(--celebrate-glow-none);
  }
  20% {
    transform: translate(-50%, -50%) scale(1.2);
    filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.5)) var(--celebrate-outline) var(--celebrate-glow-strong);
  }
  44% {
    background-position: -50% 0, 0 0;
    transform: translate(-50%, -50%) scale(1.05);
    filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.5)) var(--celebrate-outline) var(--celebrate-glow-strong);
  }
  48% { background-position: 150% 0, 0 0; }
  80% {
    background-position: -50% 0, 0 0;
    filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.5)) var(--celebrate-outline) var(--celebrate-glow-strong);
  }
  100% {
    background-position: 150% 0, 0 0;
    transform: translate(-50%, -50%) scale(1);
    filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.5)) var(--celebrate-outline) var(--celebrate-glow-none);
  }
}

/* ---- 悬停重放：仅精确指针设备，且不在庆祝中；reduced-motion 下不重放 ---- */
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .cylinder-wrapper.is-complete:not(.is-celebrating):hover .cup-halo {
    animation: celebrate-halo-once var(--duration-celebrate) ease-out 1;
  }

  .cylinder-wrapper.is-complete:not(.is-celebrating):hover .cup-arc {
    animation: celebrate-arc-once var(--duration-celebrate) linear 1;
  }

  .cylinder-wrapper.is-complete:not(.is-celebrating):hover .progress-text {
    animation: celebrate-sheen-once var(--duration-celebrate) ease-in-out 1;
  }
}

@keyframes celebrate-halo-once {
  0% { opacity: 0.32; transform: translate(-50%, -50%) scale(1); }
  25% { opacity: 0.85; transform: translate(-50%, -50%) scale(1.07); }
  100% { opacity: 0.32; transform: translate(-50%, -50%) scale(1); }
}

@keyframes celebrate-arc-once {
  0% { opacity: 0; --ang: 0deg; }
  10% { opacity: 1; }
  90% { opacity: 1; --ang: 360deg; }
  100% { opacity: 0; --ang: 360deg; }
}

@keyframes celebrate-sheen-once {
  0% {
    background-position: 150% 0, 0 0;
    transform: translate(-50%, -50%) scale(1);
    filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.5)) var(--celebrate-outline) var(--celebrate-glow-none);
  }
  12% {
    transform: translate(-50%, -50%) scale(1.18);
    filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.5)) var(--celebrate-outline) var(--celebrate-glow-strong);
  }
  40% {
    background-position: -50% 0, 0 0;
    filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.5)) var(--celebrate-outline) var(--celebrate-glow-strong);
  }
  50% { background-position: 150% 0, 0 0; }
  80% { background-position: -50% 0, 0 0; }
  100% {
    background-position: 150% 0, 0 0;
    transform: translate(-50%, -50%) scale(1);
    filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.5)) var(--celebrate-outline) var(--celebrate-glow-none);
  }
}

/* ---- Label ---- */
.cylinder-label {
  margin-top: 8px;
  font-size: var(--text-xs);
  text-align: center;
  color: var(--color-text-secondary);
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
  transition: color var(--duration-fast) var(--ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .cylinder-wrapper:hover .cylinder-label {
    color: var(--color-text-primary);
  }
}
</style>
