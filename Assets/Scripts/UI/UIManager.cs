using System;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using GemTD.Core;

namespace GemTD.UI
{
    public class UIManager : MonoBehaviour
    {
        public static UIManager Instance { get; private set; }

        [Header("Top HUD Elements")]
        [SerializeField] private TextMeshProUGUI waveText;
        [SerializeField] private TextMeshProUGUI livesText;
        [SerializeField] private TextMeshProUGUI goldText;
        [SerializeField] private TextMeshProUGUI scoreText;
        [SerializeField] private TextMeshProUGUI phaseBannerText;

        [Header("Bottom Dock Controls")]
        [SerializeField] private GameObject buildingDock;
        [SerializeField] private GameObject choosingDock;
        [SerializeField] private Button upgradeChanceBtn;
        [SerializeField] private TextMeshProUGUI upgradeChanceText;
        [SerializeField] private Button rerollBtn;
        [SerializeField] private Button keepGemBtn;

        [Header("Modals")]
        [SerializeField] private GameObject codexModal;
        [SerializeField] private GameObject shopModal;
        [SerializeField] private GameObject gameOverModal;
        [SerializeField] private GameObject victoryModal;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            // Subscribe to GameManager events for zero-allocation UI updates
            GameManager.Instance.OnStateChanged += HandleStateChanged;
            GameManager.Instance.OnGoldChanged += HandleGoldChanged;
            GameManager.Instance.OnLivesChanged += HandleLivesChanged;
            GameManager.Instance.OnWaveChanged += HandleWaveChanged;

            // Wire Dock Buttons
            if (upgradeChanceBtn != null) upgradeChanceBtn.onClick.AddListener(OnUpgradeChanceClicked);
            if (rerollBtn != null) rerollBtn.onClick.AddListener(OnRerollClicked);
            if (keepGemBtn != null) keepGemBtn.onClick.AddListener(OnKeepGemClicked);

            // Initial UI Sync
            HandleGoldChanged(GameManager.Instance.Gold);
            HandleLivesChanged(GameManager.Instance.Lives);
            HandleWaveChanged(GameManager.Instance.CurrentWave);
            HandleStateChanged(GameManager.Instance.CurrentState);
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnStateChanged -= HandleStateChanged;
                GameManager.Instance.OnGoldChanged -= HandleGoldChanged;
                GameManager.Instance.OnLivesChanged -= HandleLivesChanged;
                GameManager.Instance.OnWaveChanged -= HandleWaveChanged;
            }
        }

        private void HandleStateChanged(GamePhase state)
        {
            if (buildingDock != null) buildingDock.SetActive(state == GamePhase.Building);
            if (choosingDock != null) choosingDock.SetActive(state == GamePhase.Choosing);

            if (phaseBannerText != null)
            {
                switch (state)
                {
                    case GamePhase.Building:
                        phaseBannerText.text = $"BUILDING: Place {GameConfig.GEMS_PER_ROUND - GameManager.Instance.PlacedGemsThisRound.Count} more gems on the maze";
                        break;
                    case GamePhase.Choosing:
                        phaseBannerText.text = "CHOOSING: Select 1 gem to keep as an active tower! The others become rocks.";
                        break;
                    case GamePhase.Wave:
                        phaseBannerText.text = $"COMBAT: Wave {GameManager.Instance.CurrentWave} in progress!";
                        break;
                    case GamePhase.Victory:
                        phaseBannerText.text = "VICTORY! You defended the Gem Castle!";
                        if (victoryModal != null) victoryModal.SetActive(true);
                        break;
                    case GamePhase.GameOver:
                        phaseBannerText.text = "GAME OVER: The castle has fallen!";
                        if (gameOverModal != null) gameOverModal.SetActive(true);
                        break;
                }
            }

            UpdateChanceButton();
        }

        private void HandleGoldChanged(int gold)
        {
            if (goldText != null) goldText.text = gold.ToString();
            UpdateChanceButton();
        }

        private void HandleLivesChanged(int lives)
        {
            if (livesText != null) livesText.text = lives.ToString();
        }

        private void HandleWaveChanged(int wave)
        {
            if (waveText != null) waveText.text = $"Wave {wave} / {GameConfig.TOTAL_WAVES}";
        }

        private void UpdateChanceButton()
        {
            if (upgradeChanceBtn == null || upgradeChanceText == null) return;

            int level = GameManager.Instance.ChanceLevel;
            if (level >= GameConfig.CHANCE_UPGRADES.Length)
            {
                upgradeChanceText.text = "Chance Level: MAX";
                upgradeChanceBtn.interactable = false;
            }
            else
            {
                int cost = GameConfig.CHANCE_UPGRADES[level].cost;
                upgradeChanceText.text = $"Upgrade Chances ({cost} Gold)";
                upgradeChanceBtn.interactable = GameManager.Instance.Gold >= cost;
            }
        }

        private void OnUpgradeChanceClicked()
        {
            GameManager.Instance.UpgradeChances();
        }

        private void OnRerollClicked()
        {
            GameManager.Instance.RerollGems();
        }

        private void OnKeepGemClicked()
        {
            if (GameManager.Instance.SelectedTower != null)
            {
                GameManager.Instance.KeepGem(GameManager.Instance.SelectedTower);
            }
        }

        public void ToggleCodexModal()
        {
            if (codexModal != null) codexModal.SetActive(!codexModal.activeSelf);
        }

        public void ToggleShopModal()
        {
            if (shopModal != null) shopModal.SetActive(!shopModal.activeSelf);
        }
    }
}
