using System;
using System.Collections.Generic;
using UnityEngine;
using GemTD.Core;
using GemTD.Towers;

namespace GemTD.Grid
{
    public class GridManager : MonoBehaviour
    {
        public static GridManager Instance { get; private set; }

        [Header("Prefabs")]
        [SerializeField] private TowerController towerPrefab;
        [SerializeField] private GameObject slatePrefab;

        private TileType[,] boardGrid;
        private TowerController[,] towerGrid;
        private PathfindingService pathfinding;

        private readonly List<TowerController> activeGems = new List<TowerController>();
        private readonly List<TowerController> allEntities = new List<TowerController>();

        public PathfindingService Pathfinding => pathfinding;
        public List<TowerController> ActiveGems => activeGems;
        public List<TowerController> AllEntities => allEntities;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            InitializeGrid();
        }

        public void InitializeGrid()
        {
            boardGrid = new TileType[GameConfig.GRID_HEIGHT, GameConfig.GRID_WIDTH];
            towerGrid = new TowerController[GameConfig.GRID_HEIGHT, GameConfig.GRID_WIDTH];
            pathfinding = new PathfindingService(GameConfig.GRID_WIDTH, GameConfig.GRID_HEIGHT);

            // Set Checkpoints
            for (int i = 0; i < GameConfig.CHECKPOINTS.Length; i++)
            {
                Vector2Int cp = GameConfig.CHECKPOINTS[i];
                boardGrid[cp.y, cp.x] = TileType.Checkpoint;
            }

            pathfinding.ValidateFullRoute(boardGrid, out _);
            activeGems.Clear();
            allEntities.Clear();
        }

        public Vector2Int WorldToGrid(Vector3 worldPos)
        {
            int x = Mathf.RoundToInt(worldPos.x / GameConfig.DEFAULT_TILE_SIZE);
            int y = Mathf.RoundToInt(worldPos.z / GameConfig.DEFAULT_TILE_SIZE);
            return new Vector2Int(x, y);
        }

        public Vector3 GridToWorld(int x, int y)
        {
            return new Vector3(x * GameConfig.DEFAULT_TILE_SIZE, 0f, y * GameConfig.DEFAULT_TILE_SIZE);
        }

        public bool CanPlaceAt(int x, int y)
        {
            return pathfinding.CanPlaceAt(boardGrid, x, y);
        }

        public TowerController PlaceGem(int x, int y, GemData data)
        {
            if (!CanPlaceAt(x, y)) return null;

            Vector3 worldPos = GridToWorld(x, y);
            TowerController tower = Instantiate(towerPrefab, worldPos, Quaternion.identity, transform);
            tower.Initialize(x, y, data);

            boardGrid[y, x] = TileType.Tower;
            towerGrid[y, x] = tower;

            activeGems.Add(tower);
            allEntities.Add(tower);

            pathfinding.ValidateFullRoute(boardGrid, out _);
            return tower;
        }

        public void TurnToSlate(TowerController tower)
        {
            if (tower == null) return;
            tower.TurnIntoSlate();
            boardGrid[tower.tileY, tower.tileX] = TileType.Slate;
            activeGems.Remove(tower);
        }

        public bool DemolishSlate(int x, int y)
        {
            if (!pathfinding.IsInside(x, y)) return false;
            TowerController t = towerGrid[y, x];
            if (t == null || !t.IsSlate) return false;

            towerGrid[y, x] = null;
            boardGrid[y, x] = TileType.Empty;
            allEntities.Remove(t);
            Destroy(t.gameObject);

            pathfinding.ValidateFullRoute(boardGrid, out _);
            return true;
        }

        public TowerController GetTowerAt(int x, int y)
        {
            if (!pathfinding.IsInside(x, y)) return null;
            return towerGrid[y, x];
        }
    }
}
