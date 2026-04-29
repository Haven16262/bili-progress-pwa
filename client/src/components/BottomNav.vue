<template>
  <nav class="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex z-50 safe-area-bottom">
    <router-link to="/" class="flex-1 flex flex-col items-center py-2 text-xs" active-class="text-cyan-400" exact>
      <span class="text-xl">🏠</span>
      <span>主页</span>
    </router-link>
    <router-link to="/settings" class="flex-1 flex flex-col items-center py-2 text-xs" active-class="text-cyan-400">
      <span class="text-xl">⚙️</span>
      <span>设置</span>
    </router-link>
  </nav>
</template>
