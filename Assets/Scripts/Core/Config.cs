using System;
using System.Collections.Generic;
using UnityEngine;

namespace GemTD.Core
{
    public static class GameConfig
    {
        public const int GRID_WIDTH = 33;
        public const int GRID_HEIGHT = 33;
        public const float DEFAULT_TILE_SIZE = 1.0f; // Unity world units per grid cell

        public const int STARTING_LIVES = 50;
        public const int STARTING_GOLD = 60;
        public const int GEMS_PER_ROUND = 5;
        public const int TOTAL_WAVES = 50;
        public const int CREEPS_PER_WAVE = 10;
        public const float SPAWN_INTERVAL = 0.9f;

        // Costs & Gold Sinks
        public const int SLATE_REMOVE_COST = 15;
        public const int REROLL_COST = 20;
        public const int DOWNGRADE_COST = 10;
        public const int MOVE_TOWER_COST = 30;
        public const int HEAL_CASTLE_COST = 60;
        public const int HEAL_CASTLE_AMOUNT = 10;
        public const int MAX_TOWER_RUNES = 3;

        // Checkpoint positions (0 = Spawn, 1..3 = Waypoints, 4 = Castle)
        public static readonly Vector2Int[] CHECKPOINTS = new Vector2Int[]
        {
            new Vector2Int(2, 2),    // Checkpoint 0: Spawn Portal
            new Vector2Int(30, 2),   // Checkpoint 1: Waypoint 1 (Top-Right)
            new Vector2Int(30, 30),  // Checkpoint 2: Waypoint 2 (Bottom-Right)
            new Vector2Int(2, 30),   // Checkpoint 3: Waypoint 3 (Bottom-Left)
            new Vector2Int(16, 16)   // Checkpoint 4: Gem Castle (Center)
        };

        // Chance probabilities per tier level
        public struct ChanceLevel
        {
            public int level;
            public int cost;
            public float[] chances; // Chipped, Flawed, Regular, Flawless, Perfect
            public string label;

            public ChanceLevel(int lvl, int c, float[] ch, string lbl)
            {
                level = lvl;
                cost = c;
                chances = ch;
                label = lbl;
            }
        }

        public static readonly ChanceLevel[] CHANCE_UPGRADES = new ChanceLevel[]
        {
            new ChanceLevel(1, 0,   new float[] { 1.00f, 0.00f, 0.00f, 0.00f, 0.00f }, "Level 1: 100% Chipped"),
            new ChanceLevel(2, 20,  new float[] { 0.70f, 0.30f, 0.00f, 0.00f, 0.00f }, "Level 2: 70% Chipped, 30% Flawed"),
            new ChanceLevel(3, 60,  new float[] { 0.40f, 0.45f, 0.15f, 0.00f, 0.00f }, "Level 3: 40% Chipped, 45% Flawed, 15% Regular"),
            new ChanceLevel(4, 150, new float[] { 0.20f, 0.35f, 0.35f, 0.10f, 0.00f }, "Level 4: 20% Chipped, 35% Flawed, 35% Reg, 10% Flawless"),
            new ChanceLevel(5, 350, new float[] { 0.10f, 0.25f, 0.35f, 0.25f, 0.05f }, "Level 5: 10% Chipped, 25% Flawed, 35% Reg, 25% Flawless, 5% Perfect"),
            new ChanceLevel(6, 800, new float[] { 0.05f, 0.15f, 0.30f, 0.35f, 0.15f }, "Level 6: 5% Chipped, 15% Flawed, 30% Reg, 35% Flawless, 15% Perfect")
        };
    }

    public enum GamePhase
    {
        Building,
        Choosing,
        Wave,
        Victory,
        GameOver
    }

    public enum GemQuality
    {
        Chipped = 1,
        Flawed = 2,
        Regular = 3,
        Flawless = 4,
        Perfect = 5
    }

    public enum GemTypeCode
    {
        B, // Sapphire
        D, // Diamond
        E, // Emerald
        G, // Opal
        Q, // Aquamarine
        R, // Ruby
        T, // Topaz
        Y  // Amethyst
    }
}
