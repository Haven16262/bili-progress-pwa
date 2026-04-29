<template>
  <div class="min-h-screen flex items-center justify-center p-6">
    <div class="w-full max-w-sm bg-slate-800 rounded-xl p-6 space-y-4">
      <h1 class="text-xl font-bold text-center">Bili Progress</h1>
      <p class="text-slate-400 text-sm text-center">请输入应用密码</p>
      <input
        v-model="password"
        type="password"
        placeholder="APP_PASSWORD"
        class="w-full px-4 py-2 bg-slate-700 rounded-lg border border-slate-600 focus:border-cyan-400 outline-none"
        @keyup.enter="submit"
      />
      <p v-if="error" class="text-red-400 text-xs text-center">{{ error }}</p>
      <button
        @click="submit"
        class="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition"
      >
        解锁
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['unlocked'])
const password = ref('')
const error = ref('')

async function submit() {
  error.value = ''
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    })
    const data = await res.json()
    if (data.token) {
      localStorage.setItem('token', data.token)
      emit('unlocked')
    } else {
      error.value = data.error || '密码错误'
    }
  } catch {
    error.value = '无法连接服务器'
  }
}
</script>
