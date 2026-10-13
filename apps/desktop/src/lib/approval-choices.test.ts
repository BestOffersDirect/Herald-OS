import { describe, expect, it } from 'vitest'
import { approvalFacts } from './approval-choices.ts'

describe('approvalFacts', () => {
  it('offers allow once and deny when the request lists nothing', () => {
    expect(approvalFacts({ command: 'ls /tmp' }).choices).toEqual(['once', 'deny'])
  })

  it('drops the session and permanent answers the request rules out', () => {
    expect(approvalFacts({ choices: ['once', 'session', 'always', 'deny'], allow_permanent: false }).choices).toEqual(['once', 'session', 'deny'])
    expect(approvalFacts({ choices: ['once', 'session', 'always', 'deny'], allow_session: false }).choices).toEqual(['once', 'always', 'deny'])
  })

  it('never pre-authorises destructive bridge actions, and ignores unknown answers', () => {
    const facts = approvalFacts({ command: '<system_kill_process> (plugin approval rule)', choices: ['once', 'session', 'always', 'deny', 'forever'] })

    expect(facts).toMatchObject({ bridgeTool: 'system_kill_process', toolName: 'system_kill_process', destructive: true })
    expect(facts.choices).toEqual(['once', 'deny'])
    expect(approvalFacts({ command: '<system_trash_files> (plugin approval rule)', description: 'Trash 3 files', choices: ['once', 'always', 'deny'] }).choices).toEqual(['once', 'deny'])
  })
})
