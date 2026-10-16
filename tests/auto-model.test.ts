import { expect, mock, test } from 'claude-code/testing'
import type { EngineInterface, On } from 'claude-code'

const USAGE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

// Stands in for the engine: the classifier answers `tier`, and each model request records its model.
function world(on: On, tier: string) {
  const sent: string[] = []
  mock.store(on)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('command.run', () => ({ text: '' }))
  on('model.complete', () => ({ value: { isAnswered: true, text: tier, usage: USAGE } }))
  on('turn.step', async function* (_$, e) {
    sent.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  return sent
}

async function turn($: EngineInterface, turnId: string, text: string, model: string) {
  await $.turn.start({ turnId, text })
  const stream = $.turn.step({ turnId, index: 0, model, messageCount: 1 })
  for await (const _ of stream) void _
  await $.turn.complete({ turnId, answer: '', durationMs: 1, isAborted: false, reason: 'answer' } as Parameters<EngineInterface['turn']['complete']>[0])
}

test('a simple prompt steps down to Haiku', async ($, on) => {
  const sent = world(on, 'haiku')
  await turn($, 't1', 'hva er 2+2?', 'claude-opus-5-5')
  expect(sent).toEqual(['claude-haiku-5-5'])
})

test('never goes above the model the person picked', async ($, on) => {
  const sent = world(on, 'opus')
  await turn($, 't1', 'design a new architecture', 'claude-sonnet-5-5')
  expect(sent).toEqual(['claude-sonnet-5-5'])
})

test('/auto-model off leaves the model alone', async ($, on) => {
  const sent = world(on, 'haiku')
  await $.command.run({ command: 'auto-model', args: 'off' } as Parameters<EngineInterface['command']['run']>[0])
  await turn($, 't1', 'hva er 2+2?', 'claude-opus-5-5')
  expect(sent).toEqual(['claude-opus-5-5'])
})
