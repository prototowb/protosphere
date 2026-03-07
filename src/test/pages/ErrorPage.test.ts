import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ErrorPage from '@/pages/ErrorPage.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/channels/@me', component: { template: '<div/>' } },
    ],
  })
}

describe('ErrorPage', () => {
  it('shows generic message when no error prop', () => {
    const wrapper = mount(ErrorPage, { global: { plugins: [makeRouter()] } })
    expect(wrapper.text()).toContain('Something went wrong')
    expect(wrapper.text()).toContain('An unexpected error occurred')
  })

  it('shows the error string when error prop is provided', () => {
    const wrapper = mount(ErrorPage, {
      props: { error: 'Database connection failed' },
      global: { plugins: [makeRouter()] },
    })
    expect(wrapper.text()).toContain('Database connection failed')
  })

  it('Reload button calls window.location.reload', async () => {
    const wrapper = mount(ErrorPage, { global: { plugins: [makeRouter()] } })
    const reloadBtn = wrapper.findAll('button').find((b) => b.text() === 'Reload')
    await reloadBtn!.trigger('click')
    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })

  it('Go Home button navigates to /channels/@me', async () => {
    const router = makeRouter()
    const pushSpy = vi.spyOn(router, 'push')
    const wrapper = mount(ErrorPage, { global: { plugins: [router] } })
    const homeBtn = wrapper.findAll('button').find((b) => b.text() === 'Go Home')
    await homeBtn!.trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/channels/@me')
  })
})
