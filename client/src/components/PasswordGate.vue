<template>
  <div class="gate">
    <div class="gate-card">
      <h1 class="gate-card__title">Bili Progress</h1>
      <p class="gate-card__desc">请输入应用密码</p>
      <input
        v-model="password"
        type="password"
        placeholder="APP_PASSWORD"
        class="gate-card__input"
        @keyup.enter="submit"
      />
      <p v-if="error" class="gate-card__error">{{ error }}</p>
      <button
        @click="submit"
        class="gate-card__btn"
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

<style scoped>
.gate {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.gate-card {
  width: 100%;
  max-width: 24rem;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  -webkit-backdrop-filter: blur(var(--glass-blur));
  backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--glass-shadow);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .gate-card {
    background: var(--color-surface-elevated);
  }
}

.gate-card__title {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-text-primary);
  text-align: center;
}

.gate-card__desc {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-align: center;
}

.gate-card__input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: rgb(255 255 255 / 0.06);
  border: 1px solid rgb(255 255 255 / 0.16);
  border-radius: var(--glass-radius-control);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.gate-card__input:focus {
  border-color: var(--color-border-focus);
}

.gate-card__input::placeholder {
  color: rgb(244 242 251 / 0.6);
}

.gate-card__error {
  font-size: var(--text-xs);
  color: var(--color-danger);
  text-align: center;
}

.gate-card__btn {
  width: 100%;
  padding: 0.5rem 0;
  background: var(--glass-bg-control);
  border: 1px solid var(--glass-border-control);
  border-radius: var(--glass-radius-control);
  -webkit-backdrop-filter: blur(var(--glass-blur-control));
  backdrop-filter: blur(var(--glass-blur-control));
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 700;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .gate-card__btn {
    background: var(--color-surface-secondary);
  }
}

@media (hover: hover) and (pointer: fine) {
  .gate-card__btn:hover {
    background: var(--glass-bg-control-hover);
    transform: translateY(-1px);
  }
}

.gate-card__btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.gate-card__btn:active {
  transform: scale(0.97);
}
</style>
