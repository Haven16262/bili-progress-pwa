<template>
  <div class="add-modal-overlay">
    <!-- Backdrop -->
    <div class="add-modal-backdrop" @click="$emit('close')"></div>

    <!-- Sheet -->
    <div class="add-modal-sheet">
      <!-- Handle (mobile only) -->
      <div class="add-modal-handle">
        <div class="add-modal-handle__bar"></div>
      </div>

      <!-- Header -->
      <div class="add-modal-header">
        <h3 class="add-modal-header__title">从 B 站最近播放添加</h3>
        <button @click="$emit('close')" class="add-modal-header__close" aria-label="关闭">&times;</button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="add-modal-status">加载中...</div>

      <!-- Error -->
      <div v-else-if="error" class="add-modal-error">
        <p>{{ error }}</p>
        <button @click="fetchCandidates" class="add-modal-error__retry">重试</button>
      </div>

      <!-- Empty -->
      <div v-else-if="candidates.length === 0" class="add-modal-empty">
        <p>没有可添加的视频</p>
        <p class="add-modal-empty__hint">最近播放的视频都已在主页上</p>
      </div>

      <!-- List -->
      <div v-else class="add-modal-list">
        <button
          v-for="item in candidates"
          :key="item.bvid"
          class="add-modal-item"
          @click="addOne(item)"
        >
          <img
            :src="item.cover"
            :alt="item.title"
            class="add-modal-item__cover"
            crossorigin="anonymous"
            referrerpolicy="no-referrer"
          />
          <div class="add-modal-item__info">
            <p class="add-modal-item__title">{{ item.title }}</p>
            <p class="add-modal-item__meta">
              {{ item.author_name }} · 进度 {{ Math.round(item.progress) }}%
            </p>
          </div>
          <span class="add-modal-item__add">+</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../services/api.js'

const emit = defineEmits(['close', 'added'])
const loading = ref(true)
const error = ref('')
const candidates = ref([])

onMounted(() => fetchCandidates())

async function fetchCandidates() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.getRecentHistory()
    if (data.error) {
      error.value = data.error
    } else {
      candidates.value = Array.isArray(data) ? data : []
    }
  } catch {
    error.value = '无法连接服务器'
  }
  loading.value = false
}

async function addOne(item) {
  try {
    const res = await api.addVideo({
      bvid: item.bvid,
      title: item.title,
      progress: item.progress,
      duration: item.duration
    })
    if (res.ok || res.error) {
      // Remove from candidate list
      candidates.value = candidates.value.filter(c => c.bvid !== item.bvid)
      emit('added')
    }
  } catch { /* ignore */ }
}
</script>

<style scoped>
/* ---- Overlay ---- */
.add-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 51;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.add-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 0.6);
}

/* ---- Sheet ---- */
.add-modal-sheet {
  position: relative;
  width: 100%;
  max-width: 28rem;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-2xl);
  box-shadow: 0 16px 48px rgb(0 0 0 / 0.5);
  animation: scale-in var(--duration-normal) var(--ease-out) forwards;
  overflow: hidden;
}

/* ---- Handle (mobile drag indicator) ---- */
.add-modal-handle {
  display: none;
  justify-content: center;
  padding-top: 0.75rem;
  padding-bottom: 0.25rem;
}

.add-modal-handle__bar {
  width: 2.5rem;
  height: 4px;
  border-radius: 2px;
  background: var(--color-border);
}

@media (max-width: 640px) {
  .add-modal-handle {
    display: flex;
  }
}

/* ---- Header ---- */
.add-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.add-modal-header__title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.add-modal-header__close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  transition: color var(--duration-fast) var(--ease-out);
}

.add-modal-header__close:hover {
  color: var(--color-text-primary);
}

/* ---- Status states ---- */
.add-modal-status {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.add-modal-error {
  padding: 2rem;
  text-align: center;
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.add-modal-error__retry {
  margin-top: 0.75rem;
  padding: 0.5rem 1rem;
  background: var(--color-surface-secondary);
  border: none;
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}

.add-modal-error__retry:hover {
  background: var(--color-surface-hover);
}

.add-modal-empty {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.add-modal-empty__hint {
  margin-top: 0.25rem;
  font-size: var(--text-xs);
}

/* ---- List ---- */
.add-modal-list {
  overflow-y: auto;
  flex: 1;
}

.add-modal-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1.25rem;
  background: none;
  border: none;
  border-bottom: 1px solid var(--color-border-subtle);
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-align: left;
  transition: background var(--duration-fast) var(--ease-out);
}

.add-modal-item:hover {
  background: rgb(255 255 255 / 0.03);
}

.add-modal-item:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}

.add-modal-item:last-child {
  border-bottom: none;
}

.add-modal-item__cover {
  width: 3rem;
  height: 2rem;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--color-surface-secondary);
  flex-shrink: 0;
}

.add-modal-item__info {
  flex: 1;
  min-width: 0;
}

.add-modal-item__title {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-modal-item__meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.add-modal-item__add {
  color: var(--color-accent);
  font-size: 1.125rem;
  flex-shrink: 0;
}
</style>
