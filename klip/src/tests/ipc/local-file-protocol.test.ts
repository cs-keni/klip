// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { protocol } from 'electron'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

vi.mock('electron', () => ({
  protocol: {
    registerSchemesAsPrivileged: vi.fn(),
    handle: vi.fn(),
  },
}))

import { registerLocalFileProtocol } from '../../main/localFileProtocol'

const TEST_DIR  = '/tmp/klip-test-lfp'
const TEST_FILE = join(TEST_DIR, 'sample.mp4')
const TXT_FILE  = join(TEST_DIR, 'notes.txt')
const PNG_FILE  = join(TEST_DIR, 'image.png')
const MP3_FILE  = join(TEST_DIR, 'audio.mp3')

let handler: (req: Request) => Response | Promise<Response>

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true })
  writeFileSync(TEST_FILE, 'FAKE MP4 DATA 123') // 17 bytes
  writeFileSync(TXT_FILE,  'hello world')
  writeFileSync(PNG_FILE,  'PNG DATA')
  writeFileSync(MP3_FILE,  'MP3 DATA')

  registerLocalFileProtocol()
  handler = vi.mocked(protocol.handle).mock.calls[0][1] as (req: Request) => Response | Promise<Response>
})

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

// ── §5.8 Full GET requests ────────────────────────────────────────────────────

describe('full GET requests', () => {
  it('returns status 200 for an existing file', async () => {
    const req = new Request(`klip://local${TEST_FILE}`)
    const res = await handler(req)
    expect(res.status).toBe(200)
  })

  it('sets Content-Type to video/mp4 for .mp4 files', async () => {
    const req = new Request(`klip://local${TEST_FILE}`)
    const res = await handler(req)
    expect(res.headers.get('Content-Type')).toBe('video/mp4')
  })

  it('sets Content-Type to image/png for .png files', async () => {
    const req = new Request(`klip://local${PNG_FILE}`)
    const res = await handler(req)
    expect(res.headers.get('Content-Type')).toBe('image/png')
  })

  it('sets Content-Type to audio/mpeg for .mp3 files', async () => {
    const req = new Request(`klip://local${MP3_FILE}`)
    const res = await handler(req)
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
  })

  it('returns status 404 for a non-existent file', async () => {
    const req = new Request(`klip://local/no/such/file.mp4`)
    const res = await handler(req)
    expect(res.status).toBe(404)
  })

  it('includes Accept-Ranges: bytes header for streaming support', async () => {
    const req = new Request(`klip://local${TEST_FILE}`)
    const res = await handler(req)
    expect(res.headers.get('Accept-Ranges')).toBe('bytes')
  })
})

// ── §5.8 Range requests ──────────────────────────────────────────────────────

describe('range requests', () => {
  it('returns status 206 for a range request', async () => {
    const req = new Request(`klip://local${TEST_FILE}`, {
      headers: { Range: 'bytes=0-3' },
    })
    const res = await handler(req)
    expect(res.status).toBe(206)
  })

  it('includes Content-Range header matching the requested range', async () => {
    const fileSize = 17 // length of 'FAKE MP4 DATA 123'
    const req = new Request(`klip://local${TEST_FILE}`, {
      headers: { Range: 'bytes=0-3' },
    })
    const res = await handler(req)
    expect(res.headers.get('Content-Range')).toBe(`bytes 0-3/${fileSize}`)
  })
})

// ── §5.8 MIME type coverage ───────────────────────────────────────────────────

describe('MIME types', () => {
  it('returns application/octet-stream for unknown extensions', async () => {
    const unknownFile = join(TEST_DIR, 'data.xyz')
    writeFileSync(unknownFile, 'data')
    const req = new Request(`klip://local${unknownFile}`)
    const res = await handler(req)
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream')
  })
})
