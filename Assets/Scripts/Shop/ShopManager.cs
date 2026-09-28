using System;
using System.Collections.Generic;
using UnityEngine;
using GemTD.Core;
using GemTD.Grid;
using GemTD.Towers;

namespace GemTD.Shop
{
    public class ShopManager : MonoBehaviour
    {
        public static ShopManager Instance { get; private set; }

        [Header("Available Runes")]
        [SerializeField] private List<RuneData> catalogRunes = new List<RuneData>();

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        public List<RuneData> GetCatalogRunes() => catalogRunes;

        public bool BuyRuneForTower(TowerController tower, RuneData rune)
        {
            if (tower == null || rune == null) return false;
            if (!tower.CanSocketRune()) return false;
            if (GameManager.Instance.Gold < rune.cost) return false;

            GameManager.Instance.SpendGold(rune.cost);
            tower.SocketRune(rune);
            GameManager.Instance.NotifyTowerStateChanged();
            return true;
        }

        public bool BuyCastleHeal()
        {
            if (GameManager.Instance.Gold < GameConfig.HEAL_CASTLE_COST) return false;
            if (GameManager.Instance.Lives >= GameConfig.STARTING_LIVES) return false;

            GameManager.Instance.SpendGold(GameConfig.HEAL_CASTLE_COST);
            GameManager.Instance.HealLives(GameConfig.HEAL_CASTLE_AMOUNT);
            return true;
        }

        public bool DemolishSlate(int x, int y)
        {
            if (GameManager.Instance.Gold < GameConfig.SLATE_REMOVE_COST) return false;

            bool success = GridManager.Instance.DemolishSlate(x, y);
            if (success)
            {
                GameManager.Instance.SpendGold(GameConfig.SLATE_REMOVE_COST);
            }
            return success;
        }

        public bool RelocateTower(TowerController tower, int targetX, int targetY)
        {
            if (tower == null || tower.IsSlate) return false;
            if (GameManager.Instance.Gold < GameConfig.MOVE_TOWER_COST) return false;

            // Check validity at target
            if (!GridManager.Instance.CanPlaceAt(targetX, targetY)) return false;

            GameManager.Instance.SpendGold(GameConfig.MOVE_TOWER_COST);

            // Move tower and leave slate at original position
            int oldX = tower.tileX;
            int oldY = tower.tileY;

            tower.tileX = targetX;
            tower.tileY = targetY;
            tower.transform.position = GridManager.Instance.GridToWorld(targetX, targetY);

            GridManager.Instance.PlaceGem(oldX, oldY, null); // Leave slate
            GameManager.Instance.NotifyTowerStateChanged();
            return true;
        }
    }
}
