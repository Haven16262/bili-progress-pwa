<template>
  <div class="p-4 pb-20 space-y-6">
    <h2 class="text-lg font-bold">设置</h2>

    <!-- SESSDATA -->
    <section class="bg-slate-800 rounded-xl p-4 space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-sm">B 站 Cookie (SESSDATA)</h3>
        <span v-if="sessdataSet" class="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded">已设置</span>
        <span v-else class="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">未设置</span>
      </div>

      <p class="text-xs text-slate-400">
        浏览器登录 B 站 → F12 → Application → Cookies → bilibili.com → 复制 SESSDATA 的值。<br />
        有效期为半年，过期后重新填入即可。
      </p>

      <div class="flex gap-2">
        <input
          v-model="sessdataInput"
          type="password"
          placeholder="粘贴 SESSDATA..."
          class="flex-1 px-3 py-2 bg-slate-700 rounded-lg border border-slate-600 text-sm focus:border-cyan-400 outline-none"
        />
        <button
          @click="saveSessdata"
          :disabled="!sessdataInput.trim()"
          class="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black text-sm font-semibold rounded-lg transition"
        >保存</button>
      </div>
      <p v-if="sessdataMsg" class="text-xs" :class="sessdataOk ? 'text-green-400' : 'text-red-400'">
        {{ sessdataMsg }}
      </p>
    </section>

    <!-- Columns per row -->
    <section class="bg-slate-800 rounded-xl p-4 space-y-3">
      <h3 class="font-semibold text-sm">每行显示数量</h3>
      <div class="flex items-center gap-3">
        <input
          type="range"
          min="1"
          max="6"
          :value="columns"
          @input="columns = $event.target.value"
          class="flex-1 accent-cyan-400"
        />
        <span class="text-sm font-mono w-6 text-center">{{ columns }}</span>
      </div>
      <button
        @click="saveColumns"
        class="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-sm rounded-lg transition"
      >应用</button>
    </section>

    <!-- Manual Sync -->
    <section class="bg-slate-800 rounded-xl p-4 space-y-3">
      <h3 class="font-semibold text-sm">数据同步</h3>

      <!-- Sync status -->
      <div class="text-xs text-slate-400 space-y-1">
        <p v-if="syncStatus.status === 'never'">尚未执行过同步</p>
        <p v-else>
          上次同步：<span :class="syncStatus.status === 'success' ? 'text-green-400' : 'text-red-400'">
            {{ syncStatus.status === 'success' ? '成功' : '失败' }}
          </span>
          <span v-if="syncStatus.at"> · {{ formatTime(syncStatus.at) }}</span>
        </p>
        <p v-if="syncStatus.message" class="text-slate-500">{{ syncStatus.message }}</p>
      </div>

      <button
        @click="triggerSync"
        :disabled="syncing"
        class="w-full py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-semibold rounded-lg text-sm transition"
      >
        {{ syncing ? '同步中...' : '立即同步' }}
      </button>
      <p class="text-xs text-slate-500">定时任务每天 03:07 自动执行</p>
    </section>

    <!-- Info -->
    <section class="bg-slate-800/50 rounded-xl p-4 text-xs text-slate-500 space-y-1">
      <p>Bili Progress PWA v1.0</p>
      <p>进度数据以 B 站为准，名称和置顶以本地为准</p>
      <p>视频进度达 100% 持续 3 天后自动归档</p>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../services/api.js'

const sessdataInput = ref('')
const sessdataSet = ref(false)
const sessdataMsg = ref('')
const sessdataOk = ref(false)

const columns = ref(3)
const syncing = ref(false)

const syncStatus = ref({ status: 'never', message: '', at: null })

onMounted(() => {
  loadSettings()
  loadSyncStatus()
})

async function loadSettings() {
  try {
    const s = await api.getSettings()
    // sessdata is excluded from response, but we check if it exists
    columns.value = Math.max(1, Math.min(6, parseInt(s.columns_per_row) || 3))
  } catch { /* ignore */ }
}

async function loadSyncStatus() {
  try {
    syncStatus.value = await api.getSyncStatus()
  } catch { /* ignore */ }
}

async function saveSessdata() {
  const val = sessdataInput.value.trim()
  if (!val) return
  try {
    const res = await api.updateSessdata(val)
    if (res.ok) {
      sessdataSet.value = true
      sessdataInput.value = ''
      sessdataMsg.value = 'SESSDATA 已保存'
      sessdataOk.value = true
    } else {
      sessdataMsg.value = res.error || '保存失败'
      sessdataOk.value = false
    }
  } catch {
    sessdataMsg.value = '网络错误'
    sessdataOk.value = false
  }
}

async function saveColumns() {
  try {
    await api.updateSettings({ columns_per_row: String(columns.value) })
  } catch { /* ignore */ }
}

async function triggerSync() {
  syncing.value = true
  try {
    const res = await api.triggerSync()
    if (res.ok) {
      syncStatus.value = {
        status: 'success',
        message: `更新 ${res.updated} 个视频` + (res.archived ? ` · 归档 ${res.archived} 个` : ''),
        at: new Date().toISOString()
      }
    } else {
      syncStatus.value = {
        status: 'failed',
        message: res.error || '同步失败',
        at: new Date().toISOString()
      }
    }
  } catch {
    syncStatus.value = { status: 'failed', message: '网络错误', at: new Date().toISOString() }
  }
  syncing.value = false
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>
