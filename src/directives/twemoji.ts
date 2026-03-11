import twemoji from 'twemoji'
import type { DirectiveBinding } from 'vue'

const TWEMOJI_OPTIONS = {
  folder: '72x72',
  ext: '.png',
  base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
  attributes: () => ({ class: 'emoji' }),
}

function parse(el: HTMLElement, _binding?: DirectiveBinding) {
  twemoji.parse(el, TWEMOJI_OPTIONS)
}

export const vTwemoji = {
  mounted: parse,
  updated: parse,
}
