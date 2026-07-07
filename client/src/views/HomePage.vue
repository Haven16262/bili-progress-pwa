<template>
  <div class="home-page">
    <!-- Header -->
    <header class="home-header">
      <div class="home-header__info">
        <h1 class="home-header__title">观看进度</h1>
        <p v-if="!loading && videos.length > 0" class="home-header__stats">
          {{ videos.length }} 个视频<span class="home-header__dot">·</span>平均进度 {{ avgProgress }}%
        </p>
      </div>
      <button
        @click="showAdd = true"
        class="home-header__add-btn"
        title="添加视频"
        aria-label="添加视频"
      >+</button>
    </header>

    <!-- Sync problem warning banner -->
    <div
      v-if="syncProblem"
      @click="$router.push('/settings')"
      class="home-banner"
      role="alert"
    >
      <svg class="home-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>SESSDATA 可能已过期，点击前往设置更新</span>
      <span class="home-banner__arrow">→</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="home-status">加载中...</div>

    <!-- Empty state -->
    <div v-else-if="videos.length === 0" class="home-empty">
      <div class="home-empty__visual">
        <svg viewBox="0 0 80 120" fill="none" aria-hidden="true" class="home-empty__cylinder">
          <ellipse cx="40" cy="18" rx="36" ry="14" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.3"/>
          <path d="M4 18v84a14 14 0 0014 14h44a14 14 0 0014-14V18" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.2"/>
          <line x1="4" y1="48" x2="76" y2="48" stroke="currentColor" stroke-width="1" opacity="0.08"/>
          <line x1="4" y1="72" x2="76" y2="72" stroke="currentColor" stroke-width="1" opacity="0.05"/>
        </svg>
      </div>
      <p class="home-empty__title">还没有视频</p>
      <p class="home-empty__hint">点击右上角 + 号从 B 站最近播放中添加</p>
      <button
        @click="showAdd = true"
        class="home-empty__btn"
      >添加视频</button>
    </div>

    <!-- Grid (mobile: horizontal scroll) -->
    <div v-else-if="isMobile" class="home-grid-scroll">
      <div class="grid gap-3" :style="gridStyle" style="width: max-content">
        <Cylinder3D
          v-for="video in videos"
          :key="video.id"
          :progress="video.progress"
          :custom-name="video.custom_name"
          :full-title="video.title"
          @click="onEditVideo(video)"
        />
      </div>
    </div>

    <!-- Grid (tablet / desktop: fluid columns, no max-width) -->
    <div v-else class="grid gap-3" :style="gridStyle">
        <Cylinder3D
          v-for="video in videos"
          :key="video.id"
          :progress="video.progress"
          :custom-name="video.custom_name"
          :full-title="video.title"
          @click="onEditVideo(video)"
        />
      </div>

    <!-- Add video modal -->
    <AddVideoModal
      v-if="showAdd"
      @close="showAdd = false"
      @added="onVideoAdded"
    />

    <!-- Edit name modal -->
    <div
      v-if="editingVideo"
      class="modal-overlay"
      @click.self="editingVideo = null"
    >
      <div class="modal-backdrop"></div>
      <div class="modal-sheet">
        <h3 class="modal-sheet__title">修改显示名称</h3>
        <p class="modal-sheet__subtitle">{{ editingVideo.title }}</p>
        <input
          v-model="editName"
          type="text"
          maxlength="256"
          class="modal-sheet__input"
          placeholder="留空则显示原标题"
          @keyup.enter="saveEditName"
        />
        <div class="modal-sheet__actions">
          <button
            @click="editingVideo = null"
            class="modal-sheet__btn modal-sheet__btn--secondary"
          >取消</button>
          <button
            @click="saveEditName"
            class="modal-sheet__btn modal-sheet__btn--primary"
          >保存</button>
        </div>
        <button
          @click="markCompleted"
          class="modal-sheet__btn-done"
        >标记为已看完</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import Cylinder3D from '../components/Cylinder3D.vue'
import AddVideoModal from '../components/AddVideoModal.vue'
import { api } from '../services/api.js'

// Device type detection via screen width breakpoints
const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1024
const MOBILE_CYLINDER_WIDTH = 140  // px — fixed column width for mobile grid

function getDeviceType() {
  const w = window.innerWidth
  if (w <= MOBILE_BREAKPOINT) return 'mobile'
  if (w <= TABLET_BREAKPOINT) return 'tablet'
  return 'desktop'
}

function getColumnsKey(deviceType) {
  return `columns_${deviceType}`
}

function getLocalColumns(deviceType) {
  const stored = localStorage.getItem(getColumnsKey(deviceType))
  if (stored) return Math.max(1, Math.min(6, parseInt(stored, 10) || 2))
  const defaults = { mobile: 2, tablet: 3, desktop: 4 }
  return defaults[deviceType] || 3
}

const videos = ref([])
const loading = ref(true)
const columns = ref(3)
const deviceType = ref(getDeviceType())
const showAdd = ref(false)
const syncProblem = inject('syncProblem', ref(false))
const editingVideo = ref(null)
const editName = ref('')

const isMobile = computed(() => deviceType.value === 'mobile')

const avgProgress = computed(() => {
  if (videos.value.length === 0) return 0
  const sum = videos.value.reduce((acc, v) => acc + (v.progress || 0), 0)
  return Math.round(sum / videos.value.length)
})

const gridStyle = computed(() => {
  if (isMobile.value) {
    // Fixed-size columns — uniform cylinder size regardless of viewport width
    return {
      gridTemplateColumns: `repeat(${columns.value}, ${MOBILE_CYLINDER_WIDTH}px)`
    }
  }
  return {
    gridTemplateColumns: `repeat(${columns.value}, 1fr)`
  }
})

// Debounced resize handler
let resizeTimer = null
function onResize() {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    const newType = getDeviceType()
    if (newType !== deviceType.value) {
      deviceType.value = newType
      columns.value = getLocalColumns(newType)
    }
  }, 150)
}

onMounted(async () => {
  window.addEventListener('resize', onResize)
  await loadVideos()
  await loadSettings()
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  clearTimeout(resizeTimer)
})

async function loadVideos() {
  try {
    const data = await api.getVideos()
    videos.value = Array.isArray(data) ? data : []
  } catch { /* ignore */ }
  loading.value = false
}

async function loadSettings() {
  try {
    columns.value = getLocalColumns(deviceType.value)
  } catch { /* ignore */ }
}

function onVideoAdded() {
  showAdd.value = false
  loadVideos()
}

function onEditVideo(video) {
  editingVideo.value = video
  editName.value = video.custom_name || ''
}

async function saveEditName() {
  if (!editingVideo.value) return
  const name = editName.value.trim()
  try {
    await api.updateVideo(editingVideo.value.id, { custom_name: name })
    const target = videos.value.find(item => item.id === editingVideo.value.id)
    if (target) target.custom_name = name
  } catch { /* ignore */ }
  editingVideo.value = null
}

async function markCompleted() {
  if (!editingVideo.value) return
  if (!window.confirm('确定要将该视频标记为已看完吗？')) return
  try {
    await api.markVideoCompleted(editingVideo.value.id)
    // Success — update local state
    const target = videos.value.find(item => item.id === editingVideo.value.id)
    if (target) target.progress = 100
    editingVideo.value = null
  } catch (e) {
    window.alert(e.message || '操作失败，请重试')
  }
}
</script>

<style scoped>
/* ---- Page container ---- */
.home-page {
  padding: var(--space-section);
  padding-bottom: 5rem;
}

/* ---- Header ---- */
.home-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-section);
}

.home-header__info {
  min-width: 0;
}

.home-header__title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.3;
}

.home-header__stats {
  margin-top: 4px;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.home-header__dot {
  margin: 0 0.4em;
  opacity: 0.5;
}

.home-header__add-btn {
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent);
  color: var(--color-accent-text);
  border: none;
  border-radius: 50%;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.4);
}

.home-header__add-btn:hover {
  background: var(--color-accent-hover);
  transform: scale(1.08);
  box-shadow: 0 4px 16px rgb(6 182 212 / 0.35);
}

.home-header__add-btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.home-header__add-btn:active {
  transform: scale(0.95);
}

/* ---- Sync problem banner ---- */
.home-banner {
  margin-bottom: var(--space-section);
  padding: 0.625rem 1rem;
  background: rgb(248 113 113 / 0.12);
  border: 1px solid rgb(248 113 113 / 0.3);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--text-sm);
  color: rgb(252 165 165);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}

.home-banner:active {
  background: rgb(248 113 113 / 0.22);
}

.home-banner__icon {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
}

.home-banner__arrow {
  margin-left: auto;
  color: rgb(248 113 113);
  opacity: 0.7;
}

/* ---- Status & empty states ---- */
.home-status {
  text-align: center;
  color: var(--color-text-muted);
  padding: 5rem 0;
}

.home-empty {
  text-align: center;
  padding: 3rem 1rem 5rem;
  animation: fade-in-up var(--duration-slow) var(--ease-out) forwards;
}

.home-empty__visual {
  margin-bottom: 1.5rem;
}

.home-empty__cylinder {
  width: 80px;
  height: 120px;
  color: var(--color-text-muted);
  opacity: 0.5;
}

.home-empty__title {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: 0.25rem;
}

.home-empty__hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.home-empty__btn {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: var(--color-accent);
  color: var(--color-accent-text);
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.home-empty__btn:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
}

.home-empty__btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* ---- Grid ---- */
.home-grid-scroll {
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x pan-y;
  padding-bottom: 8px;
}

/* ---- Edit name modal ---- */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 51;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 0.6);
}

.modal-sheet {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-2xl);
  width: 100%;
  max-width: 24rem;
  padding: 1.25rem;
  box-shadow: 0 16px 48px rgb(0 0 0 / 0.5);
  max-height: 85dvh;
  overflow-y: auto;
  animation: scale-in var(--duration-normal) var(--ease-out) forwards;
}

.modal-sheet__title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 0.5rem;
}

.modal-sheet__subtitle {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-bottom: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-sheet__input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.modal-sheet__input:focus {
  border-color: var(--color-border-focus);
}

.modal-sheet__input::placeholder {
  color: var(--color-text-muted);
}

.modal-sheet__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.modal-sheet__btn {
  flex: 1;
  padding: 0.5rem 0;
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.modal-sheet__btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}

.modal-sheet__btn:active {
  transform: scale(0.97);
}

.modal-sheet__btn--secondary {
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
}

.modal-sheet__btn--secondary:hover {
  background: var(--color-surface-hover);
}

.modal-sheet__btn--primary {
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-weight: 600;
}

.modal-sheet__btn--primary:hover {
  background: var(--color-accent-hover);
}

.modal-sheet__btn-done {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.5rem 0;
  background: var(--color-surface-secondary);
  border: none;
  border-radius: var(--radius-lg);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.modal-sheet__btn-done:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-secondary);
}

.modal-sheet__btn-done:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}
</style>
