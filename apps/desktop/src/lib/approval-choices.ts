import type { ApprovalChoice } from '@herald-os/client'

/** Upstream labels plugin-gated approvals `<tool> (plugin approval rule)`; the tool name is what the user needs. */
const PLUGIN_RULE_RE = /^<([a-z0-9_]+)> \(plugin approval rule\)$/i
/** Bridge actions that must never be pre-authorised; the plugin already rotates their rule key, this hides the misleading button. */
const BRIDGE_DESTRUCTIVE = new Set(['system_kill_process'])
const DESTRUCTIVE_SUMMARY_RE = /^(trash|force quit|force kill|terminate|quit)\b/i
const KNOWN: readonly ApprovalChoice[] = ['once', 'session', 'always', 'deny']

export interface ApprovalShape {
  command?: string | null
  description?: string | null
  tool_name?: string | null
  choices?: readonly string[] | null
  allow_permanent?: boolean | null
  allow_session?: boolean | null
}

export interface ApprovalFacts {
  /** The bridge tool behind a plugin approval rule, when it is one. */
  bridgeTool: string | null
  toolName: string | null
  destructive: boolean
  /** The answers the card offers, in its order. */
  choices: ApprovalChoice[]
}

/** What the approval card shows and offers for a request, wherever it is drawn. */
export function approvalFacts(params: ApprovalShape): ApprovalFacts {
  const bridgeTool = PLUGIN_RULE_RE.exec(params.command ?? '')?.[1] ?? null
  const destructive = Boolean(bridgeTool) && (BRIDGE_DESTRUCTIVE.has(bridgeTool!) || DESTRUCTIVE_SUMMARY_RE.test(params.description ?? ''))
  const asked = (params.choices?.length ? params.choices : ['once', 'deny']).filter((choice): choice is ApprovalChoice => KNOWN.includes(choice as ApprovalChoice))
  const choices = asked.filter(choice => {
    if (choice === 'always') {
      return params.allow_permanent !== false && !destructive
    }

    if (choice === 'session') {
      return params.allow_session !== false && !destructive
    }

    return true
  })

  return { bridgeTool, toolName: params.tool_name ?? bridgeTool, destructive, choices }
}
