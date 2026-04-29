<template>
  <div class="min-h-screen flex flex-col">
    <PasswordGate v-if="!authenticated" @unlocked="authenticated = true" />
    <template v-else>
      <main class="flex-1 pb-16 overflow-auto">
        <router-view />
      </main>
      <BottomNav />
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import PasswordGate from './components/PasswordGate.vue'
import BottomNav from './components/BottomNav.vue'

const authenticated = ref(false)

onMounted(async () => {
  // Check if existing token is still valid
  const token = localStorage.getItem('token')
  if (token) {
    try {
      const res = await fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        authenticated.value = true
      } else {
        // Token expired or invalid — clear it
        localStorage.removeItem('token')
      }
    } catch {
      // Server not available — don't clear in case it's just restarting
    }
  }
})
</script>
