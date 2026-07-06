<template>
  <div class="h-screen flex flex-col">
    <PasswordGate v-if="!authenticated" @unlocked="onUnlocked" />
    <template v-else>
      <main class="flex-1 pb-16 overflow-auto">
        <router-view v-slot="{ Component, route }">
          <Transition name="page-fade" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </router-view>
      </main>
      <BottomNav />
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, provide } from 'vue'
import PasswordGate from './components/PasswordGate.vue'
import BottomNav from './components/BottomNav.vue'

const authenticated = ref(false)
const syncProblem = ref(false)

provide('syncProblem', syncProblem)

onMounted(async () => {
  const token = localStorage.getItem('token')
  if (token) {
    try {
      const res = await fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        authenticated.value = true
        checkSyncStatus()
      } else {
        localStorage.removeItem('token')
      }
    } catch {
      // Server not available — don't clear in case it's just restarting
    }
  }
})

function onUnlocked() {
  authenticated.value = true
  checkSyncStatus()
}

async function checkSyncStatus() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/sync/status', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    syncProblem.value = data.hasProblem === true
  } catch {
    // Transient network error — don't alarm
  }
}
</script>

<style>
/* ---- Page transition: crossfade ---- */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>
