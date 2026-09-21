<template>
  <div class="settings-page">
    <h1 class="settings-title">设置</h1>

    <div class="settings-container">
      <!-- SESSDATA -->
      <section class="settings-card">
        <div class="settings-card__header">
          <h3 class="settings-card__heading">B 站 Cookie (SESSDATA)</h3>
          <span v-if="sessdataSet" class="badge badge--success">已设置</span>
          <span v-else class="badge badge--warning">未设置</span>
        </div>

        <p class="settings-card__desc">
          浏览器登录 B 站 → F12 → Application → Cookies → bilibili.com → 复制 SESSDATA 的值。<br />
          有效期为半年，过期后重新填入即可。
        </p>

        <div class="settings-card__row">
          <input
            v-model="sessdataInput"
            type="password"
            placeholder="粘贴 SESSDATA..."
            class="settings-input flex-1"
          />
          <button
            @click="saveSessdata"
            :disabled="!sessdataInput.trim()"
            class="settings-btn settings-btn--primary"
          >保存</button>
        </div>
        <p v-if="sessdataMsg" class="settings-feedback" :class="sessdataOk ? 'settings-feedback--ok' : 'settings-feedback--err'">
          {{ sessdataMsg }}
        </p>
      </section>

      <!-- Columns per row -->
      <section class="settings-card">
        <div class="settings-card__header">
          <h3 class="settings-card__heading">每行显示数量</h3>
          <span v-if="isMobile" class="settings-card__hint">当前设备独立设置</span>
        </div>
        <div class="settings-card__row settings-card__row--center">
          <input
            type="range"
            min="1"
            :max="isMobile ? 4 : 6"
            :value="columns"
            @input="columns = $event.target.value"
            class="settings-slider"
          />
          <span class="settings-slider__value">{{ columns }}</span>
        </div>
        <button
          @click="saveColumns"
          class="settings-btn settings-btn--secondary"
        >应用</button>
      </section>

      <!-- Manual Sync -->
      <section class="settings-card">
        <h3 class="settings-card__heading settings-card__heading--block">数据同步</h3>

        <div class="settings-sync-status">
          <p v-if="syncStatus.status === 'never'">尚未执行过同步</p>
          <p v-else>
            上次同步：<span :class="syncStatus.status === 'success' ? 'text-green-400' : 'text-red-400'">
              {{ syncStatus.status === 'success' ? '成功' : '失败' }}
            </span>
            <span v-if="syncStatus.at"> · {{ formatTime(syncStatus.at) }}</span>
          </p>
          <p v-if="syncStatus.message" class="settings-sync-status__detail">{{ syncStatus.message }}</p>
        </div>

        <button
          @click="triggerSync"
          :disabled="syncing"
          class="settings-btn settings-btn--primary settings-btn--sync"
        >
          {{ syncing ? '同步中...' : '立即同步' }}
        </button>
        <p class="settings-card__footnote">定时任务每天 03:07 自动执行</p>
      </section>

      <!-- Completed Videos -->
      <section class="settings-card">
        <details class="settings-details">
          <summary class="settings-details__summary">已观看完视频</summary>
          <div class="settings-details__body">
            <p v-if="completedVideos.length === 0" class="settings-card__empty">暂无已看完的视频</p>
            <div
              v-for="v in completedVideos"
              :key="v.id"
              class="settings-details__row"
            >
              <span class="settings-details__name">{{ v.custom_name || v.title }}</span>
              <span v-if="v.archived" class="badge badge--muted">已归档</span>
              <span v-else class="badge badge--success">已看完</span>
              <button
                @click="deleteCompleted(v)"
                :disabled="deletingIds.has(v.id)"
                class="settings-details__delete"
              >删除</button>
            </div>
          </div>
        </details>
      </section>

      <!-- Info -->
      <section class="settings-card settings-card--muted">
        <p>Bili Progress PWA v1.0</p>
        <p>进度数据以 B 站为准，名称和置顶以本地为准</p>
        <p>视频进度达 100% 持续 7 天后自动归档</p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../services/api.js'
import { confirmVideoDelete } from '../utils/videoDelete.js'

const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1024

function getDeviceType() {
  const w = window.innerWidth
  if (w <= MOBILE_BREAKPOINT) return 'mobile'
  if (w <= TABLET_BREAKPOINT) return 'tablet'
  return 'desktop'
}

function getColumnsKey(deviceType) {
  return `columns_${deviceType}`
}

const sessdataInput = ref('')
const sessdataSet = ref(false)
const sessdataMsg = ref('')
const sessdataOk = ref(false)

const deviceType = ref(getDeviceType())
const isMobile = computed(() => deviceType.value === 'mobile')
const columns = ref(isMobile.value ? 2 : 3)
const syncing = ref(false)

const syncStatus = ref({ status: 'never', message: '', at: null })
const completedVideos = ref([])
const deletingIds = ref(new Set())

onMounted(() => {
  loadSettings()
  loadSyncStatus()
  loadCompletedVideos()
})

async function loadSettings() {
  try {
    const stored = localStorage.getItem(getColumnsKey(deviceType.value))
    const defaults = { mobile: 2, tablet: 3, desktop: 4 }
    columns.value = stored ? Math.max(1, Math.min(6, parseInt(stored, 10) || defaults[deviceType.value])) : (defaults[deviceType.value] || 3)
  } catch { /* ignore */ }

  // Fetch server-side settings (sessdata_set only — value never exposed)
  try {
    const data = await api.getSettings()
    sessdataSet.value = data.sessdata_set === true
  } catch { /* ignore — keep default false */ }
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
    localStorage.setItem(getColumnsKey(deviceType.value), String(columns.value))
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

async function loadCompletedVideos() {
  try {
    const data = await api.getCompletedVideos()
    completedVideos.value = Array.isArray(data) ? data : []
  } catch { /* ignore */ }
}

async function deleteCompleted(video) {
  if (deletingIds.value.has(video.id)) return
  if (!confirmVideoDelete(video)) return

  deletingIds.value.add(video.id)
  try {
    await api.deleteVideo(video.id)
    completedVideos.value = completedVideos.value.filter(item => item.id !== video.id)
  } catch (e) {
    if (e.status === 404) {
      // 其它设备已删——按「已不存在」处理
      completedVideos.value = completedVideos.value.filter(item => item.id !== video.id)
    } else {
      window.alert(e.message || '删除失败，请重试')
    }
  } finally {
    deletingIds.value.delete(video.id)
  }
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>

<style scoped>
/* ---- Page layout ---- */
.settings-page {
  padding: var(--space-section);
}

.settings-title {
  font-family: var(--font-display);
  font-size: 1.625rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-text-primary);
  margin-bottom: var(--space-section);
}

.settings-container {
  max-width: 36rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);
}

/* ---- Card — glass panel ---- */
.settings-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  -webkit-backdrop-filter: blur(var(--glass-blur));
  backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--glass-shadow);
  padding: 1.125rem;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .settings-card {
    background: var(--color-surface);
  }
}

.settings-card--muted {
  background: var(--color-surface-muted);
  border-color: transparent;
  box-shadow: none;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.settings-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  gap: 0.5rem;
}

.settings-card__heading {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.settings-card__heading--block {
  margin-bottom: 0.5rem;
}

.settings-card__hint {
  font-size: var(--text-xs);
  color: var(--color-text-on-glass);
  flex-shrink: 0;
}

.settings-card__desc {
  font-size: var(--text-xs);
  color: var(--color-text-on-glass);
  margin-bottom: 0.75rem;
  line-height: 1.5;
}

.settings-card__row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.settings-card__row--center {
  align-items: center;
}

.settings-card__row:last-child {
  margin-bottom: 0;
}

.settings-card__footnote {
  margin-top: 0.5rem;
  font-size: var(--text-xs);
  color: var(--color-text-on-glass);
}

.settings-card__empty {
  font-size: var(--text-xs);
  color: var(--color-text-on-glass);
}

/* ---- Badges — tinted pill per 视觉稿 ---- */
.badge {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  flex-shrink: 0;
  line-height: 1.4;
}

.badge--success {
  /* green-300：叠绿色药丸底 + 玻璃 + 晕染仍过 AA（T8 实测，green-400 只有 3.4:1） */
  color: #86efac;
  background: rgb(74 222 128 / 0.16);
  border-color: rgb(74 222 128 / 0.3);
}

.badge--warning {
  color: var(--color-warning);
  background: rgb(250 204 21 / 0.16);
  border-color: rgb(250 204 21 / 0.3);
}

.badge--muted {
  color: var(--color-text-on-glass);
  background: rgb(255 255 255 / 0.06);
  border-color: rgb(255 255 255 / 0.10);
}

/* ---- Input ---- */
.settings-input {
  padding: 0.5rem 0.75rem;
  background: rgb(255 255 255 / 0.06);
  border: 1px solid rgb(255 255 255 / 0.16);
  border-radius: var(--glass-radius-control);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-out);
  min-width: 0;
}

.settings-input:focus {
  border-color: var(--color-border-focus);
}

.settings-input::placeholder {
  color: rgb(244 242 251 / 0.6);
}

/* ---- Buttons ---- */
.settings-btn {
  padding: 0.5rem 1rem;
  border-radius: var(--glass-radius-control);
  font-size: var(--text-sm);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
  white-space: nowrap;
}

.settings-btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}

.settings-btn:active {
  transform: scale(0.97);
}

/* 主操作按钮 = 玻璃白（全局者决策 3），不再纯青实心 */
.settings-btn--primary {
  background: var(--glass-bg-control);
  border: 1px solid var(--glass-border-control);
  -webkit-backdrop-filter: blur(var(--glass-blur-control));
  backdrop-filter: blur(var(--glass-blur-control));
  color: #fff;
  font-weight: 700;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .settings-btn--primary {
    background: var(--color-surface-secondary);
  }
}

.settings-btn--primary:hover:not(:disabled) {
  background: var(--glass-bg-control-hover);
}

.settings-btn--primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.settings-btn--secondary {
  background: rgb(255 255 255 / 0.06);
  border: 1px solid rgb(255 255 255 / 0.10);
  color: var(--color-text-secondary);
}

.settings-btn--secondary:hover {
  background: rgb(255 255 255 / 0.10);
}

/* "立即同步" — capped width, not full-width */
.settings-btn--sync {
  width: auto;
  min-width: 160px;
}

/* ---- Feedback message ---- */
.settings-feedback {
  font-size: var(--text-xs);
  margin-top: 0.5rem;
}

.settings-feedback--ok {
  color: var(--color-success);
}

.settings-feedback--err {
  color: var(--color-danger);
}

/* ---- Slider ---- */
/* 原生 range + accent-color：跨浏览器稳定，避免手写 track 的 webkit/moz 分叉 */
.settings-slider {
  flex: 1;
  accent-color: var(--color-accent);
  height: 6px;
}

.settings-slider__value {
  font-size: var(--text-sm);
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--color-text-primary);
  width: 1.5rem;
  text-align: center;
  flex-shrink: 0;
}

/* ---- Sync status ---- */
.settings-sync-status {
  font-size: var(--text-xs);
  color: var(--color-text-on-glass);
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

.settings-sync-status__detail {
  color: var(--color-text-on-glass);
  opacity: 0.7;
}

/* ---- Details / accordion ---- */
.settings-details__summary {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  cursor: pointer;
  user-select: none;
  list-style: none;
}

.settings-details__summary::-webkit-details-marker {
  display: none;
}

.settings-details__body {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.settings-details__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: var(--text-sm);
}

.settings-details__name {
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}

/* 紧凑版破坏性按钮（白字压 red-600 = 4.83:1 过 AA），与相邻 badge 同高 */
.settings-details__delete {
  flex-shrink: 0;
  padding: 3px 10px;
  background: var(--color-danger-solid);
  border: none;
  border-radius: 999px;
  color: #fff;
  font-size: 11px;
  line-height: 1.4;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
}

.settings-details__delete:hover:not(:disabled) {
  background: var(--color-danger-solid-hover);
}

.settings-details__delete:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}

.settings-details__delete:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
