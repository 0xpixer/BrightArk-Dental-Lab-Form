import assert from 'node:assert/strict'
import test from 'node:test'
import { persistIDesignSubmission } from './workflow'

test('returns a submitted case only after its activity is recorded', async () => {
  const events: string[] = []
  const created = await persistIDesignSubmission({
    createCase: async () => {
      events.push('case')
      return { id: 85 }
    },
    recordActivity: async () => {
      events.push('activity')
    },
    rollbackCase: async () => {
      events.push('rollback')
    },
  })

  assert.equal(created.id, 85)
  assert.deepEqual(events, ['case', 'activity'])
})

test('removes a newly created case when submission activity cannot be recorded', async () => {
  const events: string[] = []

  await assert.rejects(() => persistIDesignSubmission({
    createCase: async () => {
      events.push('case')
      return { id: 86 }
    },
    recordActivity: async () => {
      events.push('activity')
      throw new Error('activity unavailable')
    },
    rollbackCase: async () => {
      events.push('rollback')
    },
  }), /activity unavailable/)

  assert.deepEqual(events, ['case', 'activity', 'rollback'])
})
