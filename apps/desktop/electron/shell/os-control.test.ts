import { describe, expect, it, vi } from 'vitest'
import type { OsControlReply } from '../../shared/ipc.ts'
import type { UiControlRequest } from './os-control.ts'

vi.mock('electron', () => ({ ipcMain: { on: vi.fn() } }))
vi.mock('../log.ts', () => ({ log: vi.fn() }))

const { handleUiRequest, osControlToken } = await import('./os-control.ts')

const OPENED: OsControlReply = { requestId: 'oc1', result: { ok: true, summary: 'Opened Memory', page: 'memory' } }

function fakeBridge() {
  return {
    run: vi.fn(async (_command: string, _args: Record<string, unknown>, _source: 'agent' | 'cli' | 'plugin', _session?: string | null) => OPENED),
    list: vi.fn(async (): Promise<OsControlReply> => ({ requestId: 'oc2', result: [] })),
    state: vi.fn(async (): Promise<OsControlReply> => ({ requestId: 'oc3', result: { page: 'overview' } }))
  }
}

const ui = (extra: Partial<UiControlRequest> = {}): UiControlRequest => ({ cmd: 'ui', token: osControlToken(), command: 'page.open', args: { name: 'memory' }, source: 'agent', ...extra })

describe('a ui request on the control socket', () => {
  it('hands the renderer the live Hermes session it names', async () => {
    const bridge = fakeBridge()

    expect(await handleUiRequest(ui({ session: ' a1b2c3d4 ' }), bridge)).toEqual({ ok: true, summary: 'Opened Memory', page: 'memory' })
    expect(bridge.run).toHaveBeenLastCalledWith('page.open', { name: 'memory' }, 'agent', 'a1b2c3d4')

    await handleUiRequest(ui({ session: 'agent:main_1.2-x', source: 'cli' }), bridge)
    expect(bridge.run).toHaveBeenLastCalledWith('page.open', { name: 'memory' }, 'cli', 'agent:main_1.2-x')

    await handleUiRequest(ui({ session: 's'.repeat(128) }), bridge)
    expect(bridge.run).toHaveBeenLastCalledWith('page.open', { name: 'memory' }, 'agent', 's'.repeat(128))
  })

  it('drops a session that is not an id and still runs the command', async () => {
    const bridge = fakeBridge()

    for (const session of [42, null, '', '   ', 'tab 1', '../a1b2', 's'.repeat(129), { id: 'a1b2c3d4' }, ['a1b2c3d4']]) {
      expect(await handleUiRequest(ui({ session }), bridge)).toMatchObject({ ok: true })
      expect(bridge.run).toHaveBeenLastCalledWith('page.open', { name: 'memory' }, 'agent', null)
    }
  })

  it('runs a request without a session, as a bridge from before it sends', async () => {
    const bridge = fakeBridge()

    expect(await handleUiRequest(ui(), bridge)).toEqual({ ok: true, summary: 'Opened Memory', page: 'memory' })
    expect(bridge.run).toHaveBeenCalledWith('page.open', { name: 'memory' }, 'agent', null)
    expect(await handleUiRequest({ cmd: 'ui-state', token: osControlToken() }, bridge)).toEqual({ ok: true, result: { page: 'overview' } })
  })

  it('refuses a request without the launch token, whatever session it names', async () => {
    const bridge = fakeBridge()

    expect(await handleUiRequest(ui({ token: 'guess', session: 'a1b2c3d4' }), bridge)).toEqual({ ok: false, error: 'invalid control token' })
    expect(await handleUiRequest(ui({ token: undefined, session: 'a1b2c3d4' }), bridge)).toEqual({ ok: false, error: 'invalid control token' })
    expect(bridge.run).not.toHaveBeenCalled()
  })
})
