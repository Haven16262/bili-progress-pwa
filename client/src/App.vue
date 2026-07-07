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
import { api } from './services/api.js'

const authenticated = ref(false)
const syncProblem = ref(false)

provide('syncProblem', syncProblem)

onMounted(async () => {
  if (localStorage.getItem('token')) {
    try {
      await api.verifyToken()
      authenticated.value = true
      checkSyncStatus()
    } catch {
      // Server unavailable or token expired — api.js already cleared token on 401
    }
  }
})

function onUnlocked() {
  authenticated.value = true
  checkSyncStatus()
}

async function checkSyncStatus() {
  try {
    const data = await api.getSyncStatus()
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
