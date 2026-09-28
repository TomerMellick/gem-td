// Gem TD - Grid & Pathfinding System (BFS Flowfield & A*)
import { CONFIG } from './config.js';

export const TILE_TYPES = {
  EMPTY: 0,
  CHECKPOINT: 1,
  GEM_TEMP: 2,
  TOWER: 3,
  SLATE: 4
};

export class Pathfinding {
  constructor(width = CONFIG.GRID_WIDTH, height = CONFIG.GRID_HEIGHT) {
    this.width = width;
    this.height = height;
    this.checkpoints = CONFIG.CHECKPOINTS;
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
        neighbors.push({ x: d.x, y: d.y, cost: 1.4142 });
      }
    }

    return neighbors;
  }

  /**
   * Compute BFS / Dijkstra flowfield to a target coordinate
   */
  computeFlowField(grid, targetX, targetY) {
    const dist = Array.from({ length: this.height }, () => Array(this.width).fill(Infinity));
    const nextStep = Array.from({ length: this.height }, () => Array(this.width).fill(null));

    if (!this.isInside(targetX, targetY)) return { dist, nextStep };

    const queue = [];
    dist[targetY][targetX] = 0;
    queue.push({ x: targetX, y: targetY });

    // Simple priority queue or BFS using array
    // Since edge costs are ~1 and 1.414, Dijkstra or bucketed queue works nicely
    while (queue.length > 0) {
      // Find lowest dist node
      let minIdx = 0;
      for (let i = 1; i < queue.length; i++) {
        if (dist[queue[i].y][queue[i].x] < dist[queue[minIdx].y][queue[minIdx].x]) {
          minIdx = i;
        }
      }
      const current = queue.splice(minIdx, 1)[0];
      const currentDist = dist[current.y][current.x];

      const neighbors = this.getNeighbors(grid, current.x, current.y);
      for (const n of neighbors) {
        const alt = currentDist + n.cost;
        if (alt < dist[n.y][n.x]) {
          dist[n.y][n.x] = alt;
          // Step from neighbor n leads to current
          nextStep[n.y][n.x] = { x: current.x, y: current.y };
          queue.push({ x: n.x, y: n.y });
        }
      }
    }

    return { dist, nextStep };
  }

  /**
   * Find point-to-point path between two tiles
   */
  findPath(grid, startX, startY, endX, endY) {
    const { dist, nextStep } = this.computeFlowField(grid, endX, endY);
    if (dist[startY][startX] === Infinity) {
      return null;
    }

    const path = [{ x: startX, y: startY }];
    let curr = { x: startX, y: startY };
    const maxSteps = this.width * this.height;
    let steps = 0;

    while ((curr.x !== endX || curr.y !== endY) && steps < maxSteps) {
      const next = nextStep[curr.y][curr.x];
      if (!next) break;
      path.push(next);
      curr = next;
      steps++;
    }

    return path;
  }

  /**
   * Validates full course from CP0 -> CP1 -> CP2 -> CP3 -> CP4
   * Returns validity and the complete path points
   */
  validateFullRoute(grid) {
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

    return { valid: true, fullPath: segments, totalLength };
  }

  /**
   * Test if placing an obstacle at (x, y) would illegally block the maze
   */
  canPlaceAt(grid, x, y) {
    if (!this.isInside(x, y)) return false;
    if (this.isCheckpoint(x, y)) return false;
    if (grid[y][x] !== TILE_TYPES.EMPTY) return false;

    // Temporarily place rock
    grid[y][x] = TILE_TYPES.SLATE;
    const testResult = this.validateFullRoute(grid);
    grid[y][x] = TILE_TYPES.EMPTY; // restore

    return testResult.valid;
  }
}
