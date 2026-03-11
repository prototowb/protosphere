import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuth } from './composables/useAuth'
import { loadEmojiData } from './lib/emojiNames'
import './assets/main.css'

// Runtime environment validation (PTSPH-163)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
if (supabaseUrl && !/^https?:\/\/.+/.test(supabaseUrl)) {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f1117;color:#f1f5f9;font-family:sans-serif;text-align:center;padding:2rem;">
      <div>
        <h1 style="font-size:1.5rem;font-weight:700;margin-bottom:1rem;color:#f87171;">Configuration Error</h1>
        <p style="color:#94a3b8;">VITE_SUPABASE_URL is malformed. Expected a valid URL (https://...).</p>
        <pre style="margin-top:1rem;background:#1e293b;padding:1rem;border-radius:.5rem;font-size:.75rem;color:#94a3b8;">${supabaseUrl}</pre>
      </div>
    </div>`
  throw new Error(`Invalid VITE_SUPABASE_URL: "${supabaseUrl}"`)
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Global error handler — catches unhandled component errors (PTSPH-161)
app.config.errorHandler = (err, _instance, info) => {
  console.error('[App Error]', info, err)
  // Don't redirect for auth/network errors; let the component handle those
  if (err instanceof Error && err.message.includes('Failed to fetch')) return
  const msg = err instanceof Error ? err.message : String(err)
  router.push({ name: 'error', query: { error: msg } }).catch(() => {})
}

// Preload emoji data for tooltips and autocomplete (fire and forget)
loadEmojiData()

// Initialize auth listener before mounting so session is available to route guards
const { initAuthListener } = useAuth()
initAuthListener()

app.mount('#app')
