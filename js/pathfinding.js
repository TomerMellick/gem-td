// Gem TD - Grid & Pathfinding System (BFS Flowfield & A*)
import { CONFIG } from './config.js';

export const TILE_TYPES = {
  EMPTY: 0,
  CHECKPOINT: 1,
  GEM_TEMP: 2,
  TOWER: 3,
  SLATE: 4
};

// Binary Min-Heap for priority queues
class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(val) {
    this.heap.push(val);
    let idx = this.heap.length - 1;
    while (idx > 0) {
      const parentIdx = (idx - 1) >> 1;
      if (this.heap[idx].f >= this.heap[parentIdx].f) break;
      const tmp = this.heap[idx];
      this.heap[idx] = this.heap[parentIdx];
      this.heap[parentIdx] = tmp;
      idx = parentIdx;
    }
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      let idx = 0;
      const len = this.heap.length;
      while (true) {
        const left = (idx << 1) + 1;
        const right = left + 1;
        let smallest = idx;
        if (left < len && this.heap[left].f < this.heap[smallest].f) smallest = left;
        if (right < len && this.heap[right].f < this.heap[smallest].f) smallest = right;
        if (smallest === idx) break;
        const tmp = this.heap[idx];
        this.heap[idx] = this.heap[smallest];
        this.heap[smallest] = tmp;
        idx = smallest;
      }
    }
    return top;
  }

  get size() {
    return this.heap.length;
  }
}

const SQRT2 = 1.4142;

export class Pathfinding {
  constructor(width = CONFIG.GRID_WIDTH, height = CONFIG.GRID_HEIGHT) {
    this.width = width;
    this.height = height;
    this.checkpoints = CONFIG.CHECKPOINTS;
    this.currentPathSet = null;
    this.lastCachedRoute = null;
  }

  isInside(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  isCheckpoint(x, y) {
    return this.checkpoints.some(cp => cp.x === x && cp.y === y);
  }

  isPassable(grid, x, y) {
    if (!this.isInside(x, y)) return false;
    const tile = grid[y][x];
    // Empty or checkpoint tiles are passable
    return tile === TILE_TYPES.EMPTY || tile === TILE_TYPES.CHECKPOINT;
  }

  /**
   * Get valid neighbors with diagonal movement and corner-cutting prevention
   */
  getNeighbors(grid, x, y) {
    const neighbors = [];
    const cardinal = [
      { x: x + 1, y: y, cost: 1.0 },
      { x: x - 1, y: y, cost: 1.0 },
      { x: x, y: y + 1, cost: 1.0 },
      { x: x, y: y - 1, cost: 1.0 }
    ];

    for (const c of cardinal) {
      if (this.isPassable(grid, c.x, c.y)) {
        neighbors.push(c);
      }
    }

    // Diagonal movement: only allowed if both adjacent orthogonal tiles are passable
    const diagonals = [
      { x: x + 1, y: y + 1, o1: { x: x + 1, y }, o2: { x, y: y + 1 } },
      { x: x - 1, y: y + 1, o1: { x: x - 1, y }, o2: { x, y: y + 1 } },
      { x: x + 1, y: y - 1, o1: { x: x + 1, y }, o2: { x, y: y - 1 } },
      { x: x - 1, y: y - 1, o1: { x: x - 1, y }, o2: { x, y: y - 1 } }
    ];

    for (const d of diagonals) {
      if (
        this.isPassable(grid, d.x, d.y) &&
        this.isPassable(grid, d.o1.x, d.o1.y) &&
        this.isPassable(grid, d.o2.x, d.o2.y)
      ) {
        neighbors.push({ x: d.x, y: d.y, cost: SQRT2 });
      }
    }

    return neighbors;
  }

  /**
   * Compute BFS / Dijkstra flowfield to a target coordinate using MinHeap
   */
  computeFlowField(grid, targetX, targetY) {
    const dist = Array.from({ length: this.height }, () => Array(this.width).fill(Infinity));
    const nextStep = Array.from({ length: this.height }, () => Array(this.width).fill(null));

    if (!this.isInside(targetX, targetY)) return { dist, nextStep };

    const open = new MinHeap();
    dist[targetY][targetX] = 0;
    open.push({ x: targetX, y: targetY, f: 0 });

    while (open.size > 0) {
      const current = open.pop();
      const currentDist = dist[current.y][current.x];
      if (current.f > currentDist) continue;

      const neighbors = this.getNeighbors(grid, current.x, current.y);
      for (const n of neighbors) {
        const alt = currentDist + n.cost;
        if (alt < dist[n.y][n.x]) {
          dist[n.y][n.x] = alt;
          nextStep[n.y][n.x] = { x: current.x, y: current.y };
          open.push({ x: n.x, y: n.y, f: alt });
        }
      }
    }

    return { dist, nextStep };
  }

  /**
   * Fast A* point-to-point pathfinder with Octile distance heuristic
   */
  findPath(grid, startX, startY, endX, endY) {
    if (startX === endX && startY === endY) {
      return [{ x: startX, y: startY }];
    }

    const w = this.width;
    const h = this.height;
    const total = w * h;
    const gScore = new Float32Array(total).fill(Infinity);
    const parent = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);

    const startIdx = startY * w + startX;
    const endIdx = endY * w + endX;

    const octile = (x1, y1, x2, y2) => {
      const dx = Math.abs(x1 - x2);
      const dy = Math.abs(y1 - y2);
      return (dx + dy) + (SQRT2 - 2) * Math.min(dx, dy);
    };

    const open = new MinHeap();
    gScore[startIdx] = 0;
    open.push({ x: startX, y: startY, idx: startIdx, f: octile(startX, startY, endX, endY) });

    while (open.size > 0) {
      const cur = open.pop();
      const curIdx = cur.idx;
      if (curIdx === endIdx) {
        // Reconstruct path
        const path = [];
        let curr = endIdx;
        while (curr !== -1) {
          path.push({ x: curr % w, y: Math.floor(curr / w) });
          curr = parent[curr];
        }
        path.reverse();
        return path;
      }

      if (closed[curIdx]) continue;
      closed[curIdx] = 1;

      const cx = cur.x;
      const cy = cur.y;
      const curG = gScore[curIdx];

      // Cardinal neighbors
      const card = [
        cx + 1, cy,
        cx - 1, cy,
        cx, cy + 1,
        cx, cy - 1
      ];
      for (let i = 0; i < 8; i += 2) {
        const nx = card[i];
        const ny = card[i + 1];
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const tile = grid[ny][nx];
          if (tile === TILE_TYPES.EMPTY || tile === TILE_TYPES.CHECKPOINT) {
            const nIdx = ny * w + nx;
            if (!closed[nIdx]) {
              const tentativeG = curG + 1.0;
              if (tentativeG < gScore[nIdx]) {
                gScore[nIdx] = tentativeG;
                parent[nIdx] = curIdx;
                open.push({ x: nx, y: ny, idx: nIdx, f: tentativeG + octile(nx, ny, endX, endY) });
              }
            }
          }
        }
      }

      // Diagonal neighbors
      const diags = [
        cx + 1, cy + 1, cx + 1, cy, cx, cy + 1,
        cx - 1, cy + 1, cx - 1, cy, cx, cy + 1,
        cx + 1, cy - 1, cx + 1, cy, cx, cy - 1,
        cx - 1, cy - 1, cx - 1, cy, cx, cy - 1
      ];
      for (let i = 0; i < 24; i += 6) {
        const nx = diags[i];
        const ny = diags[i + 1];
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const tile = grid[ny][nx];
          if (tile === TILE_TYPES.EMPTY || tile === TILE_TYPES.CHECKPOINT) {
            const t1 = grid[diags[i + 3]][diags[i + 2]];
            const t2 = grid[diags[i + 5]][diags[i + 4]];
            if (
              (t1 === TILE_TYPES.EMPTY || t1 === TILE_TYPES.CHECKPOINT) &&
              (t2 === TILE_TYPES.EMPTY || t2 === TILE_TYPES.CHECKPOINT)
            ) {
              const nIdx = ny * w + nx;
              if (!closed[nIdx]) {
                const tentativeG = curG + SQRT2;
                if (tentativeG < gScore[nIdx]) {
                  gScore[nIdx] = tentativeG;
                  parent[nIdx] = curIdx;
                  open.push({ x: nx, y: ny, idx: nIdx, f: tentativeG + octile(nx, ny, endX, endY) });
                }
              }
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Validates full course from CP0 -> CP1 -> CP2 -> CP3 -> CP4
   * Returns validity and the complete path points
   */
  validateFullRoute(grid, updateCache = true) {
    const segments = [];
    let totalLength = 0;

    for (let i = 0; i < this.checkpoints.length - 1; i++) {
      const from = this.checkpoints[i];
      const to = this.checkpoints[i + 1];
      const segPath = this.findPath(grid, from.x, from.y, to.x, to.y);

      if (!segPath) {
        return { valid: false, segments: [], totalLength: 0 };
      }

      // Avoid duplicating the junction point between segments
      if (i > 0) {
        segments.push(...segPath.slice(1));
      } else {
        segments.push(...segPath);
      }
      totalLength += segPath.length;
    }

    const result = { valid: true, fullPath: segments, totalLength };
    if (updateCache) {
      this.lastCachedRoute = result;
      this.currentPathSet = new Set(segments.map(p => `${p.x},${p.y}`));
    }
    return result;
  }

  /**
   * Test if placing an obstacle at (x, y) would illegally block the maze
   */
  canPlaceAt(grid, x, y) {
    if (!this.isInside(x, y)) return false;
    if (this.isCheckpoint(x, y)) return false;
    if (grid[y][x] !== TILE_TYPES.EMPTY) return false;

    // Fast O(1) check: If (x, y) is NOT on the currently established valid path,
    // placing an obstacle here cannot possibly obstruct or disconnect the route.
    if (this.currentPathSet && !this.currentPathSet.has(`${x},${y}`)) {
      return true;
    }

    // Temporarily place rock and validate alternative bypass route
    grid[y][x] = TILE_TYPES.SLATE;
    const testResult = this.validateFullRoute(grid, false);
    grid[y][x] = TILE_TYPES.EMPTY; // restore

    return testResult.valid;
  }
}
