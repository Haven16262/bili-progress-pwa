<template>
  <div class="min-h-screen flex flex-col">
    <PasswordGate v-if="!authenticated" @unlocked="onUnlocked" />
    <template v-else>
      <main class="flex-1 pb-16 overflow-auto">
        <router-view />
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
