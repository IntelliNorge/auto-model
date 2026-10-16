import type { EngineInterface, Register } from 'claude-code'

type Tier = 'haiku' | 'sonnet' | 'opus'

// Edit these ids when new models ship.
export const MODELS: Record<Tier, string> = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
}
const CLASSIFIER = MODELS.haiku
const RANK: Record<Tier, number> = { haiku: 1, sonnet: 2, opus: 3 }
const LABEL: Record<Tier, string> = { haiku: 'Haiku', sonnet: 'Sonnet', opus: 'Opus' }

const SYSTEM = `You route coding-assistant prompts to the cheapest model that can do the job well.
Answer with exactly one word: haiku, sonnet or opus.
- haiku: simple questions, lookups, explanations, renaming, small single-file edits, formatting, running a command, short text.
- sonnet: ordinary multi-step coding, bug fixes, writing tests, features touching a few files, moderate analysis or writing.
- opus: hard reasoning, architecture or design decisions, large refactors across many files, tricky debugging, security review, long research.
When unsure between two, pick the stronger one.`

export function tierOf(model: string): Tier | undefined {
  const m = model.toLowerCase()
  if (m.includes('haiku')) return 'haiku'
  if (m.includes('sonnet')) return 'sonnet'
  if (m.includes('opus')) return 'opus'
  return undefined
}

export function parseTier(text: string): Tier | undefined {
  const word = text.trim().toLowerCase().match(/haiku|sonnet|opus/)
  return word ? (word[0] as Tier) : undefined
}

async function isEnabled($: EngineInterface): Promise<boolean> {
  return (await $.store.get('enabled')) !== false
}

export const register: Register = on => {
  // Per-turn choice; module state is fine here, a reload only drops the turn in flight.
  const chosen = new Map<string, Tier>()
  let last: Tier | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'auto-model',
      description: 'Automatic model choice per prompt: /auto-model [on|off|status]',
      argumentHint: '[on|off|status]',
    })
    $.ui.status((await isEnabled($)) ? 'Auto-model: on' : undefined)
    return next(e)
  })

  on('command.run', { command: 'auto-model' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const was = await isEnabled($)

    if (arg === 'status') {
      const lastText = last ? ` Last choice: ${LABEL[last]}.` : ''
      return { text: `Auto-model is ${was ? 'on' : 'off'}.${lastText}` }
    }

    const now = arg === 'on' ? true : arg === 'off' ? false : !was
    await $.store.set('enabled', now)
    $.ui.status(now ? 'Auto-model: on' : undefined)
    return {
      text: now
        ? 'Auto-model is on: each prompt runs on the cheapest model that fits (never above your /model choice).'
        : 'Auto-model is off: every prompt runs on your /model choice.',
    }
  })

  on('turn.start', async ($, e, next) => {
    if (!(await isEnabled($))) return next(e)

    if (e.text.trim() === '') {
      if (last) chosen.set(e.turnId, last)
      return next(e)
    }

    const reply = await $.model.complete({
      model: CLASSIFIER,
      system: SYSTEM,
      prompt: `Prompt:\n"""\n${e.text.slice(0, 4000)}\n"""\nModel:`,
      maxTokens: 5,
      timeoutMs: 8000,
    })
    const tier = reply.isAnswered ? parseTier(reply.text) : undefined
    if (tier) {
      chosen.set(e.turnId, tier)
      last = tier
    }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const want = e.agentId === undefined ? chosen.get(e.turnId) : undefined
    const current = tierOf(e.model)
    if (!want || !current) return yield* next(e)

    // Only ever step down from the model the person picked with /model.
    const tier = RANK[want] < RANK[current] ? want : current
    $.ui.status(`Auto-model: ${LABEL[tier]}${tier === current ? '' : ` (instead of ${LABEL[current]})`}`)
    return yield* next(tier === current ? e : { ...e, model: MODELS[tier] })
  })

  on('turn.complete', ($, e, next) => {
    chosen.delete(e.turnId)
    return next(e)
  })
}
