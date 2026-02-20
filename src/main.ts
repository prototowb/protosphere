import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuth } from './composables/useAuth'
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Initialize auth listener before mounting so session is available to route guards
const { initAuthListener } = useAuth()
initAuthListener()

app.mount('#app')
