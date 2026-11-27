import { useEffect, useState } from 'react'

export type Route =
  | { name: 'map' }
  | { name: 'world'; worldId: string }
  | { name: 'stage'; worldId: string; stageId: string }
  | { name: 'room'; roomId: string }
  | { name: 'run'; stageId: string }
  | { name: 'collection' }
  | { name: 'notfound' }

export function parseHash(hash: string): Route {
  let parts: string[]
  try { parts = hash.replace(/^#\/?/, '').replace(/\?.*$/, '').split('/').filter(Boolean).map(decodeURIComponent) }
  catch { return { name: 'notfound' } }
  const [a, b, c, d] = parts
  if (parts.length === 0) return { name: 'map' }
  if (a === 'world' && b && parts.length === 2) return { name: 'world', worldId: b }
  if (a === 'world' && b && c === 'stage' && d && parts.length === 4) return { name: 'stage', worldId: b, stageId: d }
  if (a === 'room' && b && parts.length === 2) return { name: 'room', roomId: b }
  if (a === 'run' && b && parts.length === 2) return { name: 'run', stageId: b }
  if (a === 'collection' && parts.length === 1) return { name: 'collection' }
  return { name: 'notfound' }
}

/**
 * A query parameter of the page URL. A query inside the hash (`#/room/x?autofill=1`) takes precedence over the
 * real query string (`?autofill=1#/room/x`); null when neither has it.
 */
export function queryParam(search: string, hash: string, name: string): string | null {
  const inHash = hash.includes('?') ? new URLSearchParams(hash.slice(hash.indexOf('?'))).get(name) : null
  return inHash ?? new URLSearchParams(search).get(name)
}

/** True when the query parameter `name` is "1" (see queryParam for precedence). */
export const hasQueryFlag = (search: string, hash: string, name: string): boolean => queryParam(search, hash, name) === '1'

export const hrefs = {
  map: '#/',
  world: (w: string) => `#/world/${encodeURIComponent(w)}`,
  stage: (w: string, s: string) => `#/world/${encodeURIComponent(w)}/stage/${encodeURIComponent(s)}`,
  room: (r: string) => `#/room/${encodeURIComponent(r)}`,
  run: (s: string) => `#/run/${encodeURIComponent(s)}`,
  collection: '#/collection',
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
