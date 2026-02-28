import { ref } from 'vue'
import { backend } from '@/lib/backend'
import type { PollWithResults } from '@/lib/types'

export function usePolls() {
  const polls = ref<PollWithResults[]>([])

  async function fetchPolls(channelId: string) {
    polls.value = await backend.polls.listByChannel(channelId)
  }

  async function createPoll(channelId: string, question: string, options: string[], createdBy: string) {
    await backend.polls.create(channelId, question, options, createdBy)
    await fetchPolls(channelId)
  }

  async function vote(pollId: string, optionId: string, userId: string) {
    await backend.polls.vote(pollId, optionId, userId)
    const result = await backend.polls.getResults(pollId, userId)
    const idx = polls.value.findIndex((p) => p.poll.id === pollId)
    if (idx !== -1) polls.value[idx] = result
  }

  async function closePoll(pollId: string, channelId: string) {
    await backend.polls.close(pollId)
    await fetchPolls(channelId)
  }

  return { polls, fetchPolls, createPoll, vote, closePoll }
}
