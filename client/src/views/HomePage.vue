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

    <!-- Grid -->
    <div v-else class="grid gap-3" :style="gridStyle">
      <Cylinder3D
        v-for="video in videos"
        :key="video.id"
        :progress="video.progress"
        :custom-name="video.custom_name"
        :full-title="video.title"
      />
    </div>

    <!-- Add video modal -->
    <AddVideoModal
      v-if="showAdd"
      @close="showAdd = false"
      @added="onVideoAdded"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Cylinder3D from '../components/Cylinder3D.vue'
import AddVideoModal from '../components/AddVideoModal.vue'
import { api } from '../services/api.js'

const videos = ref([])
const loading = ref(true)
const columns = ref(3)
const showAdd = ref(false)

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${columns.value}, 1fr)`
}))

onMounted(async () => {
  await loadVideos()
  await loadSettings()
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
    const s = await api.getSettings()
    if (s.columns_per_row) {
      columns.value = Math.max(1, Math.min(6, parseInt(s.columns_per_row) || 3))
    }
  } catch { /* ignore */ }
}

function onVideoAdded() {
  showAdd.value = false
  loadVideos()
}
</script>
