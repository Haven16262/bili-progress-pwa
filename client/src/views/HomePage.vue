<template>
  <div class="p-4 pb-20">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold">观看进度</h2>
      <button
        @click="showAdd = true"
        class="w-9 h-9 flex items-center justify-center bg-cyan-500 hover:bg-cyan-400 text-black rounded-full text-xl font-bold transition shadow-lg"
        title="添加视频"
      >+</button>
    </div>

    <!-- Sync problem warning banner -->
    <div
      v-if="syncProblem"
      @click="$router.push('/settings')"
      class="mb-4 px-4 py-2.5 bg-red-500/20 border border-red-500/40 rounded-lg flex items-center gap-2 text-sm text-red-300 cursor-pointer active:bg-red-500/30 transition"
    >
      <span class="text-base">⚠️</span>
      <span>SESSDATA 可能已过期，点击前往设置更新</span>
      <span class="ml-auto text-red-400">→</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center text-slate-400 py-20">加载中...</div>

    <!-- Empty state -->
    <div v-else-if="videos.length === 0" class="text-center text-slate-500 py-20">
      <p class="text-4xl mb-3">📭</p>
      <p class="text-sm">还没有视频</p>
      <p class="text-xs mt-1">点击右上角 + 号从 B 站最近播放中添加</p>
      <button
        @click="showAdd = true"
        class="mt-4 px-4 py-2 bg-cyan-500 text-black rounded-lg text-sm font-semibold"
      >添加视频</button>
    </div>

    <!-- Grid (mobile: horizontal scroll only, vertical handled by <main>) -->
    <div v-else-if="isMobile" class="mobile-grid-scroll">
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

    <!-- Grid (tablet / desktop: fluid columns) -->
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
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      @click.self="editingVideo = null"
    >
      <div class="absolute inset-0 bg-black/60"></div>
      <div class="relative bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5 pb-8 sm:pb-5 shadow-xl">
        <h3 class="text-sm font-semibold mb-3">修改显示名称</h3>
        <p class="text-xs text-slate-400 mb-3 truncate">{{ editingVideo.title }}</p>
        <input
          ref="editInput"
          v-model="editName"
          type="text"
          maxlength="256"
          class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white outline-none focus:border-cyan-500"
          placeholder="留空则显示原标题"
          @keyup.enter="saveEditName"
        />
        <div class="flex gap-2 mt-4">
          <button
            @click="editingVideo = null"
            class="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm"
          >取消</button>
          <button
            @click="saveEditName"
            class="flex-1 py-2 bg-cyan-500 text-black rounded-lg text-sm font-semibold"
          >保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, nextTick } from 'vue'
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
const editInput = ref(null)

const isMobile = computed(() => deviceType.value === 'mobile')

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
  nextTick(() => editInput.value?.focus())
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
</script>

<style scoped>
/*
  Mobile grid scroll container.
  Height: viewport minus header area (~64px) and bottom nav (~60px).
  Enables both horizontal and vertical scrolling on touch devices.
*/
.mobile-grid-scroll {
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x pan-y;
  padding-bottom: 8px;
}
</style>
