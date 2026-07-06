<template>
  <button class="cylinder-wrapper" @click="$emit('click')" :aria-label="`${displayName} — 进度 ${Math.round(progress)}%`">
    <!-- Glass cylinder -->
    <div class="cylinder-glass">
      <!-- Back rim of top opening -->
      <div class="top-rim-back"></div>

      <!-- Liquid fill area -->
      <div class="liquid-area">
        <div class="liquid-fill" :style="liquidStyle">
          <!-- Wave layers at liquid surface -->
          <div class="wave" :style="{ animationDuration: '3.2s' }"></div>
          <div class="wave wave-2" :style="{ animationDuration: '5s' }"></div>
          <!-- Meniscus — bright tension line at liquid surface -->
          <div class="meniscus"></div>
        </div>

        <!-- Bubbles rising from within the liquid -->
        <template v-if="progress > 0">
          <div
            v-for="b in bubbles"
            :key="b.id"
            class="bubble"
            :style="b.style"
          ></div>
        </template>
      </div>

      <!-- Glass highlight / reflection -->
      <div class="glass-shine"></div>

      <!-- Progress number -->
      <div class="progress-text">{{ Math.round(progress) }}%</div>

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
import { computed } from 'vue'

defineEmits(['click'])

const props = defineProps({
  progress: { type: Number, default: 0 },
  customName: { type: String, default: '' },
  fullTitle: { type: String, default: '' }
})

const displayName = computed(() => props.customName || props.fullTitle || '未命名')

// Color shifts from cyan (low) → blue → violet → purple (high)
// Token names defined in main.css: --liquid-{cyan,blue,violet,purple}-{start,end}
const liquidColor = computed(() => {
  const p = Math.max(0, Math.min(100, props.progress))
  if (p < 30) return { start: 'var(--liquid-cyan-start)', end: 'var(--liquid-cyan-end)' }
  if (p < 60) return { start: 'var(--liquid-blue-start)', end: 'var(--liquid-blue-end)' }
  if (p < 90) return { start: 'var(--liquid-violet-start)', end: 'var(--liquid-violet-end)' }
  return { start: 'var(--liquid-purple-start)', end: 'var(--liquid-purple-end)' }
})

const liquidStyle = computed(() => ({
  height: `${Math.max(2, Math.min(100, props.progress))}%`,
  background: `linear-gradient(180deg, ${liquidColor.value.start} 0%, ${liquidColor.value.end} 100%)`
}))

// Bubble generation — 3 bubbles with deterministic pseudo-random offsets.
// Deterministic: derive from progress to avoid re-roll every render.
const bubbles = computed(() => {
  const n = 3
  const result = []
  // Simple hash-like spread from progress value
  const seed = props.progress * 7 + 13
  for (let i = 0; i < n; i++) {
    const h = ((seed * (i + 1) * 31 + i * 17) % 100) / 100
    const left = 15 + ((seed * (i + 3) * 19 + i * 11) % 70)
    const size = 3 + ((seed * (i + 5) * 23) % 5)  // 3-7px
    const duration = 2.5 + ((seed * (i + 7) * 13) % 20) / 10 // 2.5-4.4s
    const delay = ((seed * (i + 9) * 11) % 30) / 10 // 0-2.9s
    result.push({
      id: i,
      style: {
        left: `${left}%`,
        width: `${size}px`,
        height: `${size}px`,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
      },
    })
  }
  return result
})
</script>

<style scoped>
/* ---- Wrapper — <button> for native focus & a11y ---- */
.cylinder-wrapper {
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

.cylinder-wrapper:hover {
  transform: translateY(-3px);
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

/* ---- Glass cylinder body ---- */
.cylinder-glass {
  position: relative;
  width: 100%;
  aspect-ratio: 0.55 / 1;
  max-width: 120px;
  border: 2px solid rgb(148 163 184 / 0.35);
  border-top: none;
  border-radius: 0 0 28% 28%;
  background: linear-gradient(
    90deg,
    rgb(30 41 59 / 0.9) 0%,
    rgb(51 65 85 / 0.5) 12%,
    rgb(71 85 105 / 0.25) 35%,
    rgb(100 116 139 / 0.15) 55%,
    rgb(71 85 105 / 0.25) 70%,
    rgb(51 65 85 / 0.5) 88%,
    rgb(30 41 59 / 0.9) 100%
  );
  box-shadow:
    inset 0 0 20px rgb(0 0 0 / 0.5),
    0 4px 16px rgb(0 0 0 / 0.4);
  overflow: hidden;
  transition:
    box-shadow var(--duration-normal) var(--ease-out),
    border-color var(--duration-normal) var(--ease-out);
}

.cylinder-wrapper:hover .cylinder-glass {
  box-shadow:
    inset 0 0 20px rgb(0 0 0 / 0.5),
    0 4px 16px rgb(0 0 0 / 0.4),
    0 0 24px rgb(6 182 212 / 0.1);
  border-color: rgb(148 163 184 / 0.55);
}

/* ---- Top rim (front — above liquid) ---- */
.top-rim {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  height: 16%;
  max-height: 22px;
  border: 2px solid rgb(148 163 184 / 0.45);
  border-bottom: 1px solid rgb(148 163 184 / 0.25);
  border-radius: 50%;
  /* Rim highlight: subtle bright spot offset-left, mimicking light source */
  background: radial-gradient(
    ellipse at 35% 55%,
    rgb(255 255 255 / 0.18) 0%,
    rgb(71 85 105 / 0.6) 30%,
    rgb(30 41 59 / 0.8) 60%,
    rgb(51 65 85 / 0.4) 100%
  );
  z-index: 4;
}

/* ---- Top rim (back — behind liquid) ---- */
.top-rim-back {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  height: 16%;
  max-height: 22px;
  border: 2px solid rgb(148 163 184 / 0.4);
  border-bottom: 1px solid rgb(148 163 184 / 0.2);
  border-radius: 50%;
  background: rgb(30 41 59 / 0.9);
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
  bottom: 0;
  left: 0;
  right: 0;
  transition: height var(--duration-liquid) var(--ease-out);
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

/* ---- Wave layers — horizontal sway, transform-only ---- */
.wave {
  position: absolute;
  top: -14px;
  left: -50%;
  width: 200%;
  height: 26px;
  background: rgb(255 255 255 / 0.1);
  border-radius: 40% 45% 36% 44% / 42% 38% 44% 40%;
  animation: wave-sway var(--duration, 3.2s) ease-in-out infinite alternate;
}

.wave-2 {
  top: -10px;
  height: 20px;
  opacity: 0.55;
  border-radius: 44% 38% 42% 38% / 38% 44% 40% 42%;
}

@keyframes wave-sway {
  0% {
    transform: translateX(-10%);
  }
  100% {
    transform: translateX(8%);
  }
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

/* ---- Bubbles — rising from within liquid, subtle ---- */
.bubble {
  position: absolute;
  bottom: 0;
  border-radius: 50%;
  opacity: 0;
  background: radial-gradient(
    circle at 35% 35%,
    rgb(255 255 255 / 0.25) 0%,
    rgb(255 255 255 / 0.06) 60%,
    transparent 100%
  );
  box-shadow: inset 0 0 2px rgb(255 255 255 / 0.15);
  animation: bubble-rise linear infinite;
  pointer-events: none;
  z-index: 1;
}

@keyframes bubble-rise {
  0% {
    transform: translateY(0) scale(0.7);
    opacity: 0;
  }
  15% {
    opacity: 0.6;
    transform: translateY(-15%) scale(1);
  }
  85% {
    opacity: 0.5;
  }
  100% {
    transform: translateY(-95%) scale(0.85);
    opacity: 0;
  }
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

.cylinder-wrapper:hover .hover-glow {
  opacity: 1;
}

/* ---- Progress text ---- */
.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: clamp(10px, 12%, 14px);
  font-weight: 700;
  color: rgb(255 255 255 / 0.9);
  text-shadow: 0 1px 4px rgb(0 0 0 / 0.8);
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

.cylinder-wrapper:hover .cylinder-label {
  color: var(--color-text-primary);
}
</style>
