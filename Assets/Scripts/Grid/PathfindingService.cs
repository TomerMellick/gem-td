using System;
using System.Collections.Generic;
using UnityEngine;
using GemTD.Core;

namespace GemTD.Grid
{
    public enum TileType
    {
        Empty = 0,
        Checkpoint = 1,
        GemTemp = 2,
        Tower = 3,
        Slate = 4
    }

    public class PathfindingService
    {
        private readonly int width;
        private readonly int height;
        private readonly Vector2Int[] checkpoints;

        private const float SQRT2 = 1.41421356f;
        private HashSet<Vector2Int> currentPathSet = new HashSet<Vector2Int>();
        private List<Vector2Int> cachedFullPath = new List<Vector2Int>();

        public HashSet<Vector2Int> CurrentPathSet => currentPathSet;
        public List<Vector2Int> CachedFullPath => cachedFullPath;

        public PathfindingService(int w = GameConfig.GRID_WIDTH, int h = GameConfig.GRID_HEIGHT)
        {
            width = w;
            height = h;
            checkpoints = GameConfig.CHECKPOINTS;
        }

        public bool IsInside(int x, int y)
        {
            return x >= 0 && x < width && y >= 0 && y < height;
        }

        public bool IsCheckpoint(int x, int y)
        {
            for (int i = 0; i < checkpoints.Length; i++)
            {
                if (checkpoints[i].x == x && checkpoints[i].y == y) return true;
            }
            return false;
        }

        public bool IsPassable(TileType[,] grid, int x, int y)
        {
            if (!IsInside(x, y)) return false;
            TileType t = grid[y, x];
            return t == TileType.Empty || t == TileType.Checkpoint;
        }

        private struct NodeCost : IComparable<NodeCost>
        {
            public int x;
            public int y;
            public int idx;
            public float f;

            public int CompareTo(NodeCost other)
            {
                return f.CompareTo(other.f);
            }
        }

        private class FastMinHeap
        {
            private NodeCost[] heap;
            public int Count { get; private set; }

            public FastMinHeap(int capacity)
            {
                heap = new NodeCost[capacity];
                Count = 0;
            }

            public void Push(NodeCost item)
            {
                if (Count == heap.Length)
                {
                    Array.Resize(ref heap, heap.Length * 2);
                }
                heap[Count] = item;
                BubbleUp(Count);
                Count++;
            }

            public NodeCost Pop()
            {
                NodeCost top = heap[0];
                Count--;
                if (Count > 0)
                {
                    heap[0] = heap[Count];
                    SinkDown(0);
                }
                return top;
            }

            public void Clear()
            {
                Count = 0;
            }

            private void BubbleUp(int idx)
            {
                NodeCost item = heap[idx];
                while (idx > 0)
                {
                    int parentIdx = (idx - 1) >> 1;
                    if (item.f >= heap[parentIdx].f) break;
                    heap[idx] = heap[parentIdx];
                    idx = parentIdx;
                }
                heap[idx] = item;
            }

            private void SinkDown(int idx)
            {
                NodeCost item = heap[idx];
                while (true)
                {
                    int left = (idx << 1) + 1;
                    int right = left + 1;
                    int smallest = idx;

                    if (left < Count && heap[left].f < heap[smallest].f) smallest = left;
                    if (right < Count && heap[right].f < heap[smallest].f) smallest = right;

                    if (smallest == idx) break;
                    heap[idx] = heap[smallest];
                    idx = smallest;
                }
                heap[idx] = item;
            }
        }

        private float HeuristicOctile(int x1, int y1, int x2, int y2)
        {
            int dx = Math.Abs(x1 - x2);
            int dy = Math.Abs(y1 - y2);
            return (dx + dy) + (SQRT2 - 2f) * Math.Min(dx, dy);
        }

        public List<Vector2Int> FindPath(TileType[,] grid, Vector2Int start, Vector2Int end)
        {
            if (start == end) return new List<Vector2Int> { start };

            int total = width * height;
            float[] gScore = new float[total];
            int[] parent = new int[total];
            bool[] closed = new bool[total];

            for (int i = 0; i < total; i++)
            {
                gScore[i] = float.PositiveInfinity;
                parent[i] = -1;
            }

            int startIdx = start.y * width + start.x;
            int endIdx = end.y * width + end.x;

            FastMinHeap open = new FastMinHeap(256);
            gScore[startIdx] = 0;
            open.Push(new NodeCost { x = start.x, y = start.y, idx = startIdx, f = HeuristicOctile(start.x, start.y, end.x, end.y) });

            // Direction offsets
            int[] cardX = { 1, -1, 0, 0 };
            int[] cardY = { 0, 0, 1, -1 };

            int[] diagX = { 1, -1, 1, -1 };
            int[] diagY = { 1, 1, -1, -1 };

            while (open.Count > 0)
            {
                NodeCost cur = open.Pop();
                int curIdx = cur.idx;

                if (curIdx == endIdx)
                {
                    List<Vector2Int> path = new List<Vector2Int>();
                    int curr = endIdx;
                    while (curr != -1)
                    {
                        path.Add(new Vector2Int(curr % width, curr / width));
                        curr = parent[curr];
                    }
                    path.Reverse();
                    return path;
                }

                if (closed[curIdx]) continue;
                closed[curIdx] = true;

                int cx = cur.x;
                int cy = cur.y;
                float curG = gScore[curIdx];

                // 4 Cardinals
                for (int i = 0; i < 4; i++)
                {
                    int nx = cx + cardX[i];
                    int ny = cy + cardY[i];

                    if (IsPassable(grid, nx, ny))
                    {
                        int nIdx = ny * width + nx;
                        if (!closed[nIdx])
                        {
                            float tentG = curG + 1.0f;
                            if (tentG < gScore[nIdx])
                            {
                                gScore[nIdx] = tentG;
                                parent[nIdx] = curIdx;
                                open.Push(new NodeCost { x = nx, y = ny, idx = nIdx, f = tentG + HeuristicOctile(nx, ny, end.x, end.y) });
                            }
                        }
                    }
                }

                // 4 Diagonals (with corner-cutting prevention)
                for (int i = 0; i < 4; i++)
                {
                    int nx = cx + diagX[i];
                    int ny = cy + diagY[i];

                    if (IsPassable(grid, nx, ny) && IsPassable(grid, nx, cy) && IsPassable(grid, cx, ny))
                    {
                        int nIdx = ny * width + nx;
                        if (!closed[nIdx])
                        {
                            float tentG = curG + SQRT2;
                            if (tentG < gScore[nIdx])
                            {
                                gScore[nIdx] = tentG;
                                parent[nIdx] = curIdx;
                                open.Push(new NodeCost { x = nx, y = ny, idx = nIdx, f = tentG + HeuristicOctile(nx, ny, end.x, end.y) });
                            }
                        }
                    }
                }
            }

            return null;
        }

        public bool ValidateFullRoute(TileType[,] grid, out List<Vector2Int> fullPath, bool updateCache = true)
        {
            fullPath = new List<Vector2Int>();

            for (int i = 0; i < checkpoints.Length - 1; i++)
            {
                Vector2Int from = checkpoints[i];
                Vector2Int to = checkpoints[i + 1];
                List<Vector2Int> seg = FindPath(grid, from, to);

                if (seg == null)
                {
                    return false;
                }

                if (i > 0)
                {
                    fullPath.AddRange(seg.GetRange(1, seg.Count - 1));
                }
                else
                {
                    fullPath.AddRange(seg);
                }
            }

            if (updateCache)
            {
                cachedFullPath = fullPath;
                currentPathSet.Clear();
                for (int p = 0; p < fullPath.Count; p++)
                {
                    currentPathSet.Add(fullPath[p]);
                }
            }

            return true;
        }

        public bool CanPlaceAt(TileType[,] grid, int x, int y)
        {
            if (!IsInside(x, y)) return false;
            if (IsCheckpoint(x, y)) return false;
            if (grid[y, x] != TileType.Empty) return false;

            Vector2Int pos = new Vector2Int(x, y);

            // Fast O(1) Path: If tile is not on the established path, it cannot block
            if (currentPathSet != null && currentPathSet.Count > 0 && !currentPathSet.Contains(pos))
            {
                return true;
            }

            // Otherwise, temporarily test slate placement
            grid[y, x] = TileType.Slate;
            bool valid = ValidateFullRoute(grid, out _, false);
            grid[y, x] = TileType.Empty;

            return valid;
        }
    }
}
