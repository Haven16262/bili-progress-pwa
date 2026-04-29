<template>
  <nav class="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex z-50 safe-area-bottom">
    <router-link to="/" class="flex-1 flex flex-col items-center py-2 text-xs" active-class="text-cyan-400" exact>
      <span class="text-xl">🏠</span>
      <span>主页</span>
    </router-link>
    <router-link to="/settings" class="flex-1 flex flex-col items-center py-2 text-xs relative" active-class="text-cyan-400">
      <span class="text-xl">⚙️</span>
      <span>设置</span>
      <span v-if="syncProblem" class="absolute top-1 right-1/3 w-2 h-2 bg-red-500 rounded-full ring-1 ring-slate-800"></span>
    </router-link>
  </nav>
</template>

<script setup>
import { inject, ref } from 'vue'
const syncProblem = inject('syncProblem', ref(false))
</script>
