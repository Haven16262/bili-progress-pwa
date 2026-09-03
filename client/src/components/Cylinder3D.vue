<template>
  <button class="cylinder-wrapper" @click="$emit('click')" :aria-label="`${displayName} — 进度 ${Math.round(progress)}%`">
    <!-- Liquid-color bloom behind the cup (cheap radial, no backdrop-filter — T7) -->
    <div class="cup-bloom" :style="bloomStyle" aria-hidden="true"></div>

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
import { computed, ref, onMounted, onUnmounted } from 'vue'

defineEmits(['click'])

const props = defineProps({
  progress: { type: Number, default: 0 },
  customName: { type: String, default: '' },
  fullTitle: { type: String, default: '' }
})

// First-load fill-up animation state
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const FILL_DURATION_MS = 800  // matches --duration-liquid

const isFilled = ref(REDUCED_MOTION)  // skip animation when reduced-motion
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

onUnmounted(() => cancelAnimationFrame(rafId))

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
