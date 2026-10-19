// Edges are { from: prerequisiteId, to: topicId }  (prerequisite -> topic that needs it)

function build(ids, edges) {
  const next = new Map(ids.map((id) => [id, []]))
  const prev = new Map(ids.map((id) => [id, []]))
  for (const { from, to } of edges) {
    if (!next.has(from) || !next.has(to) || from === to) continue // missing topic or self-loop
    if (next.get(from).includes(to)) continue // duplicate edge
    next.get(from).push(to)
    prev.get(to).push(from)
  }
  return { next, prev }
}

/** 1. Topological Sort (Kahn). Prerequisites always come first. */
export function topologicalSort(ids, edges) {
  const { next, prev } = build(ids, edges)
  const indeg = new Map(ids.map((id) => [id, prev.get(id).length]))
  const queue = ids.filter((id) => indeg.get(id) === 0)
  const order = []
  while (queue.length) {
    const id = queue.shift()
    order.push(id)
    for (const n of next.get(id)) {
      indeg.set(n, indeg.get(n) - 1)
      if (indeg.get(n) === 0) queue.push(n)
    }
  }
  return { order, hasCycle: order.length !== ids.length }
}

/** 2. BFS from a topic along "unlocks" edges. Returns [{ id, level }], start excluded. */
export function bfs(ids, edges, startId) {
  const { next } = build(ids, edges)
  if (!next.has(startId)) return []
  const seen = new Set([startId])
  const out = []
  let frontier = [startId]
  for (let level = 1; frontier.length; level++) {
    const upcoming = []
    for (const id of frontier) {
      for (const n of next.get(id)) {
        if (seen.has(n)) continue
        seen.add(n)
        out.push({ id: n, level })
        upcoming.push(n)
      }
    }
    frontier = upcoming
  }
  return out
}

/** 3. Dijkstra: cheapest chain from startId to goalId.
 *  Cost = study minutes (>= 0) of every topic on the chain. */
export function dijkstra(ids, edges, minutes, startId, goalId) {
  const { next } = build(ids, edges)
  if (!next.has(startId) || !next.has(goalId)) return null
  const w = (id) => Math.max(0, Number(minutes[id]) || 0)
  const dist = new Map(ids.map((id) => [id, Infinity]))
  const via = new Map()
  const done = new Set()
  dist.set(startId, w(startId))
  for (;;) {
    let u = null
    for (const id of ids) {
      if (!done.has(id) && dist.get(id) < (u === null ? Infinity : dist.get(u))) u = id
    }
    if (u === null || u === goalId) break
    done.add(u)
    for (const n of next.get(u)) {
      const d = dist.get(u) + w(n)
      if (d < dist.get(n)) {
        dist.set(n, d)
        via.set(n, u)
      }
    }
  }
  if (dist.get(goalId) === Infinity) return null
  const path = [goalId]
  while (path[0] !== startId) path.unshift(via.get(path[0]))
  return { path, cost: dist.get(goalId) }
}

/** True if "prereqId is a prerequisite of topicId" would create a loop (uses BFS). */
export function wouldCreateCycle(ids, edges, topicId, prereqId) {
  if (topicId === prereqId) return true
  return bfs(ids, edges, topicId).some((n) => n.id === prereqId)
}