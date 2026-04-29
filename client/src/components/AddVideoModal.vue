<template>
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/60" @click="$emit('close')"></div>

    <!-- Sheet -->
    <div class="relative w-full sm:max-w-md bg-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col shadow-2xl">
      <!-- Handle -->
      <div class="flex justify-center pt-3 pb-1 sm:hidden">
        <div class="w-10 h-1 rounded-full bg-slate-600"></div>
      </div>

      <!-- Header -->
      <div class="px-5 py-3 border-b border-slate-700 flex justify-between items-center">
        <h3 class="font-semibold">从 B 站最近播放添加</h3>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white text-xl leading-none">&times;</button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="p-8 text-center text-slate-400 text-sm">加载中...</div>

      <!-- Error -->
      <div v-else-if="error" class="p-8 text-center">
        <p class="text-red-400 text-sm mb-3">{{ error }}</p>
        <button @click="fetchCandidates" class="px-4 py-2 bg-slate-700 rounded-lg text-sm">重试</button>
      </div>

      <!-- Empty -->
      <div v-else-if="candidates.length === 0" class="p-8 text-center text-slate-500 text-sm">
        <p>没有可添加的视频</p>
        <p class="text-xs mt-1">最近播放的视频都已经在主页上了</p>
      </div>

      <!-- List -->
      <div v-else class="overflow-y-auto flex-1">
        <div
          v-for="item in candidates"
          :key="item.bvid"
          class="flex items-center gap-3 px-5 py-3 border-b border-slate-700/50 hover:bg-slate-750 transition cursor-pointer"
          @click="addOne(item)"
        >
          <!-- Cover -->
          <img
            :src="item.cover"
            :alt="item.title"
            class="w-12 h-8 rounded object-cover bg-slate-700 flex-shrink-0"
            loading="lazy"
          />

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p class="text-sm text-slate-200 truncate">{{ item.title }}</p>
            <p class="text-xs text-slate-500 mt-0.5">
              {{ item.author_name }} · 进度 {{ Math.round(item.progress) }}%
            </p>
          </div>

          <!-- Add icon -->
          <span class="text-cyan-400 text-lg flex-shrink-0">+</span>
        </div>
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
