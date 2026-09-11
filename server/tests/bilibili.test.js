import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetchVideoPages } from '../src/services/bilibili.js'

// ============================================================
// fetchVideoPages — endpoint fallback chain (wbi/view → player/pagelist)
// Stubs the global fetch; biliGet resolves it at call time.
// ============================================================

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body }
}

function httpError(status) {
  return { ok: false, status, json: async () => ({}) }
}

describe('fetchVideoPages', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('wbi/view 成功 → 返回 { pages, totalDuration }', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      code: 0,
      data: { pages: [{ cid: 101, duration: 100 }, { cid: 102, duration: 200 }] }
    }))

    const info = await fetchVideoPages('BVwbi', 'sess-fake')

    expect(info).toEqual({
      pages: [{ cid: 101, duration: 100 }, { cid: 102, duration: 200 }],
      totalDuration: 300
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/x/web-interface/wbi/view')
    expect(url.searchParams.get('bvid')).toBe('BVwbi')
  })

  test('wbi/view 抛错 → 降级 pagelist，形状适配正确且请求顺序 wbi→pagelist', async () => {
    fetchMock
      .mockResolvedValueOnce(httpError(412))
      .mockResolvedValueOnce(jsonResponse({
        code: 0,
        data: [
          { cid: 201, duration: 60, page: 1 },
          { cid: 202, duration: 120, page: 2 }
        ]
      }))

    const info = await fetchVideoPages('BVfallback', 'sess-fake')

    expect(info).toEqual({
      pages: [{ cid: 201, duration: 60 }, { cid: 202, duration: 120 }],
      totalDuration: 180
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = new URL(fetchMock.mock.calls[0][0])
    const second = new URL(fetchMock.mock.calls[1][0])
    expect(first.pathname).toBe('/x/web-interface/wbi/view')
    expect(second.pathname).toBe('/x/player/pagelist')
    expect(second.searchParams.get('bvid')).toBe('BVfallback')
  })

  test('两端皆失败 → 抛出汇总错误（含两端点名与各自错误信息）', async () => {
    fetchMock
      .mockResolvedValueOnce(httpError(412))
      .mockResolvedValueOnce(httpError(500))

    const promise = fetchVideoPages('BVboth', 'sess-fake')
    await expect(promise).rejects.toThrow('分P信息接口均失败')
    await expect(promise).rejects.toThrow('wbi/view: B站 API 请求失败: HTTP 412')
    await expect(promise).rejects.toThrow('pagelist: B站 API 请求失败: HTTP 500')
  })

  test('wbi/view 成功但 pages.length = 1 → 返回 null（负缓存语义，不触发降级）', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      code: 0,
      data: { pages: [{ cid: 301, duration: 300 }] }
    }))

    expect(await fetchVideoPages('BVsingle', 'sess-fake')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('降级路径 pagelist 单P → 返回 null', async () => {
    fetchMock
      .mockResolvedValueOnce(httpError(412))
      .mockResolvedValueOnce(jsonResponse({ code: 0, data: [{ cid: 401, duration: 90 }] }))

    expect(await fetchVideoPages('BVsingle2', 'sess-fake')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
