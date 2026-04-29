import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import HomePage from './views/HomePage.vue'
import SettingsPage from './views/SettingsPage.vue'
import './assets/styles/main.css'

const routes = [
  { path: '/', component: HomePage },
  { path: '/settings', component: SettingsPage }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

createApp(App).use(router).mount('#app')
