using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using GemTD.Core;
using GemTD.Grid;
using GemTD.Towers;
using GemTD.Shop;

namespace GemTD.UI
{
    public class TowerInspectorUI : MonoBehaviour
    {
        [Header("Root Panel")]
        [SerializeField] private GameObject inspectorPanel;

        [Header("Tower Header")]
        [SerializeField] private TextMeshProUGUI towerNameText;
        [SerializeField] private TextMeshProUGUI qualityText;
        [SerializeField] private Image gemIcon;

        [Header("Stats")]
        [SerializeField] private TextMeshProUGUI damageText;
        [SerializeField] private TextMeshProUGUI attackSpeedText;
        [SerializeField] private TextMeshProUGUI rangeText;
        [SerializeField] private TextMeshProUGUI dpsText;
        [SerializeField] private TextMeshProUGUI killsText;
        [SerializeField] private TextMeshProUGUI totalDamageText;

        [Header("Combination Container")]
        [SerializeField] private GameObject comboSection;
        [SerializeField] private Transform comboCardsParent;
        [SerializeField] private GameObject comboCardPrefab;

        [Header("Slate Actions")]
        [SerializeField] private GameObject slateSection;
        [SerializeField] private Button demolishSlateBtn;
        [SerializeField] private TextMeshProUGUI demolishCostText;

        private TowerController currentTower;

        private void Start()
        {
            GameManager.Instance.OnSelectionChanged += HandleSelectionChanged;
            if (demolishSlateBtn != null) demolishSlateBtn.onClick.AddListener(OnDemolishClicked);
            HandleSelectionChanged(null);
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnSelectionChanged -= HandleSelectionChanged;
            }
        }

        private void HandleSelectionChanged(TowerController tower)
        {
            currentTower = tower;
            if (tower == null)
            {
                if (inspectorPanel != null) inspectorPanel.SetActive(false);
                return;
            }

            if (inspectorPanel != null) inspectorPanel.SetActive(true);

            if (tower.IsSlate)
            {
                RenderSlateView(tower);
            }
            else
            {
                RenderTowerView(tower);
            }
        }

        private void RenderSlateView(TowerController slate)
        {
            if (towerNameText != null) towerNameText.text = "Rock Slate";
            if (qualityText != null) qualityText.text = "Obstacle Wall";

            if (damageText != null) damageText.text = "DMG: --";
            if (attackSpeedText != null) attackSpeedText.text = "SPD: --";
            if (rangeText != null) rangeText.text = "RNG: --";
            if (dpsText != null) dpsText.text = "DPS: --";
            if (killsText != null) killsText.text = "Kills: --";
            if (totalDamageText != null) totalDamageText.text = "Total: --";

            if (comboSection != null) comboSection.SetActive(false);
            if (slateSection != null) slateSection.SetActive(true);
            if (demolishCostText != null) demolishCostText.text = $"Demolish ({GameConfig.SLATE_REMOVE_COST}G)";
        }

        private void RenderTowerView(TowerController tower)
        {
            if (slateSection != null) slateSection.SetActive(false);

            float dmg = tower.GetEffectiveDamage();
            float spd = tower.GetEffectiveAttackSpeed();
            float rng = tower.GetEffectiveRange();
            float dps = dmg * spd;

            if (towerNameText != null) towerNameText.text = tower.TowerName;
            if (qualityText != null) qualityText.text = tower.IsSpecial ? "Special Tower" : tower.Quality.ToString();

            if (damageText != null) damageText.text = $"DMG: {dmg:F0}";
            if (attackSpeedText != null) attackSpeedText.text = $"SPD: {spd:F2}/s";
            if (rangeText != null) rangeText.text = $"RNG: {rng:F1}";
            if (dpsText != null) dpsText.text = $"DPS: {dps:F0}";
            if (killsText != null) killsText.text = $"Kills: {tower.killCount}";
            if (totalDamageText != null) totalDamageText.text = $"Total: {tower.totalDamageDealt:F0}";

            // Render available combinations
            RenderCombinations(tower);
        }

        private void RenderCombinations(TowerController tower)
        {
            if (comboSection == null || comboCardsParent == null) return;

            // Clear old cards
            for (int i = comboCardsParent.childCount - 1; i >= 0; i--)
            {
                Destroy(comboCardsParent.GetChild(i).gameObject);
            }

            List<TowerController> allTowers = GridManager.Instance.ActiveGems;
            List<CombinationResult> combos = GameManager.Instance.RecipeDatabase.FindCombinationsForTower(tower, allTowers);

            if (combos.Count == 0)
            {
                comboSection.SetActive(false);
                return;
            }

            comboSection.SetActive(true);

            for (int i = 0; i < combos.Count; i++)
            {
                CombinationResult combo = combos[i];
                GameObject card = Instantiate(comboCardPrefab, comboCardsParent);

                var title = card.transform.Find("Title")?.GetComponent<TextMeshProUGUI>();
                if (title != null) title.text = combo.name;

                var combineBtn = card.GetComponentInChildren<Button>();
                if (combineBtn != null)
                {
                    combineBtn.onClick.AddListener(() =>
                    {
                        GameManager.Instance.CombineTower(currentTower, combo);
                    });
                }
            }
        }

        private void OnDemolishClicked()
        {
            if (currentTower != null && currentTower.IsSlate)
            {
                ShopManager.Instance.DemolishSlate(currentTower.tileX, currentTower.tileY);
            }
        }
    }
}
