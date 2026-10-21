import {
  topologicalSort,
  bfs,
  bfsPath,
  wouldCreateCycle,
  dijkstra,
  layerOf,
} from './graph.js'

export function runGraphTests() {
  const ids = ['alg', 'trig', 'calc1', 'calc2']
  const edges = [
    { from: 'alg', to: 'trig' },
    { from: 'alg', to: 'calc1' },
    { from: 'trig', to: 'calc2' },
    { from: 'calc1', to: 'calc2' },
  ]
  const minutes = { alg: 20, trig: 60, calc1: 25, calc2: 40 }

  // 1. Topological Sort
  const topo = topologicalSort(ids, edges)
  if (topo.hasCycle) throw new Error('Expected DAG without cycle')
  if (topo.order[0] !== 'alg' || topo.order[3] !== 'calc2') {
    throw new Error('Topological sort order invalid')
  }

  // 2. Cycle Detection (DFS)
  const cycle = wouldCreateCycle(ids, edges, 'alg', 'calc2')
  if (!cycle || cycle.length === 0) {
    throw new Error('Expected cycle when linking calc2 -> alg')
  }

  // 3. BFS Reachability & Shortest Hop Path
  const reached = bfs(ids, edges, 'alg')
  if (reached.length !== 3) throw new Error('Expected 3 reachable nodes from alg')
  const shortestHops = bfsPath(ids, edges, 'alg', 'calc2')
  if (!shortestHops || shortestHops.length !== 3) {
    throw new Error('Expected 3-node path in BFS')
  }

  // 4. Dijkstra Weighted Shortest Path
  const fastest = dijkstra(ids, edges, minutes, 'alg', 'calc2')
  if (!fastest || fastest.cost !== 85 || fastest.path.join(',') !== 'alg,calc1,calc2') {
    throw new Error(`Expected alg->calc1->calc2 (85m), got ${JSON.stringify(fastest)}`)
  }

  // 5. Layering
  const layers = layerOf(ids, edges)
  if (layers.get('alg') !== 0 || layers.get('calc2') !== 2) {
    throw new Error('Layer calculation mismatch')
  }

  return true
}