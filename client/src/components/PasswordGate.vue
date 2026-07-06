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
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.gate-card__title {
  font-size: 1.25rem;
  font-weight: 700;
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
  background: var(--color-surface-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.gate-card__input:focus {
  border-color: var(--color-border-focus);
}

.gate-card__input::placeholder {
  color: var(--color-text-muted);
}

.gate-card__error {
  font-size: var(--text-xs);
  color: var(--color-danger);
  text-align: center;
}

.gate-card__btn {
  width: 100%;
  padding: 0.5rem 0;
  background: var(--color-accent);
  color: var(--color-accent-text);
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.gate-card__btn:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
}

.gate-card__btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.gate-card__btn:active {
  transform: scale(0.97);
}
</style>
