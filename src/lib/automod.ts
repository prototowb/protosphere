import type { AutomodRule, AutomodAction } from '@/lib/types'

export interface AutomodResult {
  action: AutomodAction
  rule: AutomodRule
  details: string
}

/**
 * Check message content against a list of automod rules.
 * Returns the first matching result, or null if the message is clean.
 */
export function checkAutomod(content: string, rules: AutomodRule[]): AutomodResult | null {
  for (const rule of rules) {
    if (!rule.enabled) continue
    const details = checkRule(content, rule)
    if (details !== null) {
      return { action: rule.action, rule, details }
    }
  }
  return null
}

function checkRule(content: string, rule: AutomodRule): string | null {
  const cfg = rule.config as Record<string, unknown>

  switch (rule.rule_type) {
    case 'word_filter': {
      const words = (cfg.words as string[] | undefined) ?? []
      const lower = content.toLowerCase()
      const found = words.find((w) => lower.includes(w.toLowerCase()))
      return found ? `Blocked word: "${found}"` : null
    }

    case 'link_filter': {
      const urlRegex = /https?:\/\/[^\s]+/gi
      const matches = content.match(urlRegex)
      if (!matches) return null
      const blockedDomains = (cfg.blocked_domains as string[] | undefined) ?? []
      if (blockedDomains.length === 0) return 'Links are not allowed'
      const bad = blockedDomains.find((domain) =>
        matches.some((url) => url.toLowerCase().includes(domain.toLowerCase())),
      )
      return bad ? `Blocked domain: ${bad}` : null
    }

    case 'caps_filter': {
      const threshold = (cfg.threshold as number | undefined) ?? 0.7
      const letters = content.replace(/[^a-zA-Z]/g, '')
      if (letters.length < 10) return null
      const upperCount = letters.split('').filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length
      const ratio = upperCount / letters.length
      return ratio >= threshold ? `Excessive caps (${Math.round(ratio * 100)}%)` : null
    }

    case 'spam_detect': {
      const maxRepeat = (cfg.max_repeat as number | undefined) ?? 5
      const maxLength = (cfg.max_length as number | undefined) ?? 2000
      if (content.length > maxLength) return `Message too long (${content.length}/${maxLength} chars)`
      const repeatRegex = new RegExp(`(.)\\1{${maxRepeat},}`)
      if (repeatRegex.test(content)) return 'Repeated characters detected'
      return null
    }

    default:
      return null
  }
}
