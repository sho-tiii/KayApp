/* ================================================================== */
/* Graph algorithms (Module 5)                                         */
/* Edges are { from: prerequisiteId, to: topicId }                     */
/* ================================================================== */

export const ALGORITHMS = {
  topo: { name: 'Topological Sorting', uses: 'Queue (Kahn)', time: 'O(V + E)' },
  bfs: { name: 'Breadth-First Search', uses: 'Queue (FIFO)', time: 'O(V + E)' },
  dfs: { name: 'Depth-First Search', uses: 'Recursion (stack)', time: 'O(V + E)' },
  dijkstra: { name: "Dijkstra's Algorithm", uses: 'Priority Queue (min-heap)', time: 'O((V + E) log V)' },
}

export function build(ids, edges) {
  const next = new Map(ids.map((id) => [id, []]))
  const prev = new Map(ids.map((id) => [id, []]))
  for (const { from, to } of edges) {
    if (!next.has(from) || !next.has(to) || from === to) continue
    if (next.get(from).includes(to)) continue
    next.get(from).push(to)
    prev.get(to).push(from)
  }
  return { next, prev }
}

export function topologicalSort(ids, edges) {
  const { next, prev } = build(ids, edges)
  const indeg = new Map(ids.map((id) => [id, prev.get(id).length]))
  const queue = ids.filter((id) => indeg.get(id) === 0)
  for (let head = 0; head < queue.length; head++) {
    for (const n of next.get(queue[head])) {
      indeg.set(n, indeg.get(n) - 1)
      if (indeg.get(n) === 0) queue.push(n)
    }
  }
  return { order: queue, hasCycle: queue.length !== ids.length }
}

export function bfs(ids, edges, startId) {
  const { next } = build(ids, edges)
  if (!next.has(startId)) return []
  const level = new Map([[startId, 0]])
  const queue = [startId]
  const out = []
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head]
    for (const n of next.get(u)) {
      if (level.has(n)) continue
      level.set(n, level.get(u) + 1)
      out.push({ id: n, level: level.get(n) })
      queue.push(n)
    }
  }
  return out
}

export function bfsPath(ids, edges, startId, goalId) {
  const { next } = build(ids, edges)
  if (!next.has(startId) || !next.has(goalId)) return null
  const parent = new Map([[startId, null]])
  const queue = [startId]
  for (let head = 0; head < queue.length && !parent.has(goalId); head++) {
    for (const n of next.get(queue[head])) {
      if (parent.has(n)) continue
      parent.set(n, queue[head])
      queue.push(n)
    }
  }
  if (!parent.has(goalId)) return null
  const path = []
  for (let id = goalId; id !== null; id = parent.get(id)) path.unshift(id)
  return path
}

export function findCycle(ids, edges) {
  const { next } = build(ids, edges)
  const state = new Map()
  const stack = []
  const visit = (id) => {
    state.set(id, 1)
    stack.push(id)
    for (const n of next.get(id)) {
      if (state.get(n) === 1) return [...stack.slice(stack.indexOf(n)), n]
      if (!state.has(n)) {
        const loop = visit(n)
        if (loop) return loop
      }
    }
    stack.pop()
    state.set(id, 2)
    return null
  }
  for (const id of ids) {
    if (!state.has(id)) {
      const loop = visit(id)
      if (loop) return loop
    }
  }
  return null
}

export function wouldCreateCycle(ids, edges, topicId, prereqId) {
  if (topicId === prereqId) return [topicId, topicId]
  return findCycle(ids, [...edges, { from: prereqId, to: topicId }])
}

function swap(a, i, j) {
  const t = a[i]
  a[i] = a[j]
  a[j] = t
}

export class MinHeap {
  constructor() {
    this.a = []
  }
  get size() {
    return this.a.length
  }
  push(item) {
    const a = this.a
    a.push(item)
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p][0] <= a[i][0]) break
      swap(a, p, i)
      i = p
    }
  }
  pop() {
    const a = this.a
    const top = a[0]
    const last = a.pop()
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l][0] < a[m][0]) m = l
        if (r < a.length && a[r][0] < a[m][0]) m = r
        if (m === i) break
        swap(a, m, i)
        i = m
      }
    }
    return top
  }
}

export function dijkstra(ids, edges, minutes, startId, goalId) {
  const { next } = build(ids, edges)
  if (!next.has(startId) || !next.has(goalId)) return null
  const w = (id) => Math.max(0, Number(minutes[id]) || 0)
  const dist = new Map(ids.map((id) => [id, Infinity]))
  const via = new Map()
  const done = new Set()
  const heap = new MinHeap()
  dist.set(startId, w(startId))
  heap.push([dist.get(startId), startId])
  while (heap.size) {
    const [d, u] = heap.pop()
    if (done.has(u)) continue
    done.add(u)
    if (u === goalId) break
    for (const n of next.get(u)) {
      const nd = d + w(n)
      if (nd < dist.get(n)) {
        dist.set(n, nd)
        via.set(n, u)
        heap.push([nd, n])
      }
    }
  }
  if (dist.get(goalId) === Infinity) return null
  const path = [goalId]
  while (path[0] !== startId) path.unshift(via.get(path[0]))
  return { path, cost: dist.get(goalId) }
}

export function layerOf(ids, edges) {
  const { next } = build(ids, edges)
  const { order } = topologicalSort(ids, edges)
  const layer = new Map(ids.map((id) => [id, 0]))
  for (const id of order) {
    for (const n of next.get(id)) layer.set(n, Math.max(layer.get(n), layer.get(id) + 1))
  }
  return layer
}