<template>
  <nav class="nav-bar">
    <router-link
      to="/"
      class="nav-link"
      active-class="nav-link--active"
      exact
      aria-label="主页"
    >
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
      <span class="nav-label">主页</span>
    </router-link>

    <router-link
      to="/settings"
      class="nav-link"
      active-class="nav-link--active"
      aria-label="设置"
    >
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
      <span class="nav-label">设置</span>
      <span
        v-if="syncProblem"
        class="nav-badge"
        aria-label="同步异常"
      ></span>
    </router-link>
  </nav>
</template>

<script setup>
import { inject, ref } from 'vue'
const syncProblem = inject('syncProblem', ref(false))
</script>

<style scoped>
/* ---- Nav bar container — floating glass bar (视觉稿 + 全局者决策 2) ---- */
.nav-bar {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: 18px;
  display: flex;
  background: var(--glass-bg-nav);
  border: 1px solid var(--glass-border-nav);
  border-radius: var(--glass-radius-nav);
  -webkit-backdrop-filter: blur(var(--glass-blur-nav));
  backdrop-filter: blur(var(--glass-blur-nav));
  box-shadow: var(--glass-shadow-nav);
  z-index: 50; /* 弹窗遮罩 z-[51] 契约不变（WORKFLOW.md 层级约定） */
  /* iOS 安全区改为 margin 应用：浮起条上移，不挤压自身内容 */
  margin-bottom: env(safe-area-inset-bottom, 0);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .nav-bar {
    background: var(--color-surface);
  }
}


/* ---- Nav link — default state ---- */
/* 未激活 0.65：叠底部紫色晕染 + 玻璃底仍过 WCAG AA（T8 实测 5.1:1） */
.nav-link {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 0;
  color: rgb(255 255 255 / 0.65);
  text-decoration: none;
  transition: color var(--duration-fast) var(--ease-out);
  position: relative;
}

.nav-link:hover {
  color: rgb(255 255 255 / 0.85);
}

.nav-link:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
  border-radius: var(--radius-md);
}

/* ---- Nav link — active state ---- */
.nav-link--active {
  color: var(--color-accent);
}

.nav-link--active:hover {
  color: var(--color-accent-hover);
}

/* ---- Icon ---- */
.nav-icon {
  width: 1.5rem;
  height: 1.5rem;
  margin-bottom: 2px;
  transition: transform var(--duration-fast) var(--ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .nav-link:hover .nav-icon {
    transform: scale(1.1);
  }
}

.nav-link:active .nav-icon {
  transform: scale(0.95);
}

.nav-link--active .nav-icon {
  transform: scale(1.05);
}

/* ---- Label ---- */
.nav-label {
  font-size: var(--text-xs);
  line-height: 1;
}

/* ---- Sync problem badge ---- */
.nav-badge {
  position: absolute;
  top: 4px;
  right: calc(33% - 4px);
  width: 8px;
  height: 8px;
  background: var(--color-danger);
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--color-page);
}

/* ---- 桌面/平板：浮起条限宽居中（用户拍板，2026-09-03） ----
   fixed + left/right:16px 先拉伸，max-width 收紧为胶囊，
   margin-inline:auto 吃掉两侧余量居中；≤768px 手机端无此规则，维持现状 */
@media (min-width: 769px) {
  .nav-bar {
    max-width: 420px;
    margin-inline: auto;
  }
}
</style>
