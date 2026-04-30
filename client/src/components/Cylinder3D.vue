<template>
  <div class="cylinder-wrapper" @click="$emit('click')">
    <!-- Glass cylinder -->
    <div class="cylinder-glass">
      <!-- Back rim of top opening -->
      <div class="top-rim-back"></div>

      <!-- Liquid fill area -->
      <div class="liquid-area">
        <div class="liquid-fill" :style="liquidStyle">
          <!-- Wave 1 -->
          <div
            class="wave"
            :style="{ animationDuration: '4s' }"
          ></div>
          <!-- Wave 2 -->
          <div
            class="wave wave-2"
            :style="{ animationDuration: '6s' }"
          ></div>
        </div>
      </div>

      <!-- Glass highlight / reflection -->
      <div class="glass-shine"></div>

      <!-- Progress number (only if enough space) -->
      <div class="progress-text">{{ Math.round(progress) }}%</div>

      <!-- Front rim of top opening -->
      <div class="top-rim"></div>
    </div>

    <!-- Bottom label -->
    <div class="cylinder-label" :title="fullTitle">{{ displayName }}</div>
  </div>
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

// Color shifts from cyan (low) → blue → purple (high)
const liquidColor = computed(() => {
  const p = Math.max(0, Math.min(100, props.progress))
  if (p < 30) return { start: '#06b6d4', end: '#0891b2' }       // cyan
  if (p < 60) return { start: '#3b82f6', end: '#2563eb' }       // blue
  if (p < 90) return { start: '#8b5cf6', end: '#7c3aed' }       // violet
  return { start: '#a855f7', end: '#9333ea' }                    // purple (finishing)
})

const liquidStyle = computed(() => ({
  height: `${Math.max(2, Math.min(100, props.progress))}%`,
  background: `linear-gradient(180deg, ${liquidColor.value.start} 0%, ${liquidColor.value.end} 100%)`
}))
</script>

<style scoped>
.cylinder-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 8px 4px;
}

.cylinder-glass {
  position: relative;
  width: 100%;
  /* Aspect ratio: narrower width, taller height */
  aspect-ratio: 0.55 / 1;
  max-width: 120px;
  /* Glass border */
  border: 2px solid rgba(148, 163, 184, 0.35);
  border-top: none;
  border-radius: 0 0 28% 28%;
  /* Glass body shading */
  background: linear-gradient(
    90deg,
    rgba(30, 41, 59, 0.9) 0%,
    rgba(51, 65, 85, 0.5) 12%,
    rgba(71, 85, 105, 0.25) 35%,
    rgba(100, 116, 139, 0.15) 55%,
    rgba(71, 85, 105, 0.25) 70%,
    rgba(51, 65, 85, 0.5) 88%,
    rgba(30, 41, 59, 0.9) 100%
  );
  box-shadow:
    inset 0 0 20px rgba(0, 0, 0, 0.5),
    0 4px 16px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  cursor: pointer;
}

/* Top rim - elliptical opening */
.top-rim {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  height: 16%;
  max-height: 22px;
  border: 2px solid rgba(148, 163, 184, 0.4);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 50%;
  background: radial-gradient(
    ellipse at 50% 60%,
    rgba(30, 41, 59, 0.8) 0%,
    rgba(51, 65, 85, 0.4) 60%,
    rgba(71, 85, 105, 0.3) 100%
  );
  z-index: 4;
}

/* Back half of rim (behind liquid) */
.top-rim-back {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  height: 16%;
  max-height: 22px;
  border: 2px solid rgba(148, 163, 184, 0.4);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 50%;
  background: rgba(30, 41, 59, 0.9);
  z-index: 2;
}

/* Liquid fill container */
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
  transition: height 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 0 0 26% 26%;
  overflow: hidden;
  box-shadow: inset 0 8px 16px rgba(255, 255, 255, 0.1);
}

/* Wave animation elements */
.wave {
  position: absolute;
  top: -16px;
  left: -50%;
  width: 200%;
  height: 32px;
  background: rgba(255, 255, 255, 0.15);
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

/* Glass highlight stripe */
.glass-shine {
  position: absolute;
  top: 12%;
  bottom: 8%;
  left: 18%;
  width: 14%;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.12) 0%,
    rgba(255, 255, 255, 0.04) 50%,
    rgba(255, 255, 255, 0.08) 100%
  );
  border-radius: 40%;
  z-index: 3;
  pointer-events: none;
}

/* Progress percentage overlay */
.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: clamp(10px, 12%, 14px);
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  z-index: 5;
  pointer-events: none;
  white-space: nowrap;
}

/* Label below cylinder */
.cylinder-label {
  margin-top: 8px;
  font-size: 12px;
  text-align: center;
  color: #cbd5e1;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}
</style>
