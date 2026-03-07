import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import NotFoundPage from '@/pages/NotFoundPage.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/channels/@me', name: 'dms', component: { template: '<div/>' } },
    ],
  })
}

describe('NotFoundPage', () => {
  it('renders 404 heading', () => {
    const wrapper = mount(NotFoundPage, { global: { plugins: [makeRouter()] } })
    expect(wrapper.text()).toContain('404')
    expect(wrapper.text()).toContain('Page Not Found')
  })

  it('Go Home button navigates to /channels/@me', async () => {
    const router = makeRouter()
    const pushSpy = vi.spyOn(router, 'push')
    const wrapper = mount(NotFoundPage, { global: { plugins: [router] } })
    await wrapper.find('button').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/channels/@me')
  })
})
