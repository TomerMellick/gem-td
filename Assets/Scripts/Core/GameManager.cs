using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using GemTD.Grid;
using GemTD.Towers;
using GemTD.Creeps;

namespace GemTD.Core
{
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Databases")]
        [SerializeField] private RecipeDatabase recipeDatabase;
        [SerializeField] private List<GemData> baseGemTemplates = new List<GemData>();
        [SerializeField] private List<WaveData> waveDefinitions = new List<WaveData>();
        [SerializeField] private CreepController creepPrefab;

        [Header("State")]
        [SerializeField] private GamePhase currentState = GamePhase.Building;
        [SerializeField] private int lives = GameConfig.STARTING_LIVES;
        [SerializeField] private int gold = GameConfig.STARTING_GOLD;
        [SerializeField] private int currentWave = 1;
        [SerializeField] private int chanceLevel = 1;
        [SerializeField] private int score = 0;
        [SerializeField] private float gameSpeed = 1f;

        // Current round collections
        private readonly List<TowerController> placedGemsThisRound = new List<TowerController>();
        private readonly List<CreepController> activeCreeps = new List<CreepController>();
        private TowerController selectedTower = null;

        // Wave spawning coroutine
        private Coroutine waveCoroutine;

        // Event callbacks for UI
        public event Action<GamePhase> OnStateChanged;
        public event Action<int> OnGoldChanged;
        public event Action<int> OnLivesChanged;
        public event Action<int> OnWaveChanged;
        public event Action<TowerController> OnSelectionChanged;

        public GamePhase CurrentState => currentState;
        public int Lives => lives;
        public int Gold => gold;
        public int CurrentWave => currentWave;
        public int ChanceLevel => chanceLevel;
        public int Score => score;
        public TowerController SelectedTower => selectedTower;
        public List<TowerController> PlacedGemsThisRound => placedGemsThisRound;
        public RecipeDatabase RecipeDatabase => recipeDatabase;

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
            ResetGame();
        }

        public void ResetGame()
        {
            lives = GameConfig.STARTING_LIVES;
            gold = GameConfig.STARTING_GOLD;
            currentWave = 1;
            chanceLevel = 1;
            score = 0;
            currentState = GamePhase.Building;
            selectedTower = null;
            placedGemsThisRound.Clear();
            activeCreeps.Clear();

            Time.timeScale = gameSpeed;

            if (GridManager.Instance != null)
            {
                GridManager.Instance.InitializeGrid();
            }

            OnStateChanged?.Invoke(currentState);
            OnGoldChanged?.Invoke(gold);
            OnLivesChanged?.Invoke(lives);
            OnWaveChanged?.Invoke(currentWave);
            OnSelectionChanged?.Invoke(null);
        }

        private void Update()
        {
            // Update towers combat during wave
            if (currentState == GamePhase.Wave)
            {
                float dt = Time.deltaTime;
                List<TowerController> gems = GridManager.Instance.ActiveGems;
                for (int i = 0; i < gems.Count; i++)
                {
                    gems[i].UpdateCombat(dt, activeCreeps);
                }
            }
        }

        public void SelectTower(TowerController tower)
        {
            selectedTower = tower;
            OnSelectionChanged?.Invoke(selectedTower);
        }

        public GemData RollRandomGem()
        {
            if (baseGemTemplates.Count == 0) return null;

            GemData template = baseGemTemplates[UnityEngine.Random.Range(0, baseGemTemplates.Count)];
            float[] chances = GameConfig.CHANCE_UPGRADES[chanceLevel - 1].chances;

            float rand = UnityEngine.Random.value;
            float cumulative = 0f;
            GemQuality quality = GemQuality.Chipped;

            for (int i = 0; i < chances.Length; i++)
            {
                cumulative += chances[i];
                if (rand <= cumulative)
                {
                    quality = (GemQuality)(i + 1);
                    break;
                }
            }

            GemData gem = ScriptableObject.CreateInstance<GemData>();
            gem.gemName = $"{quality} {template.typeCode}";
            gem.typeCode = template.typeCode;
            gem.quality = quality;
            gem.baseDamage = template.baseDamage * (int)quality;
            gem.baseAttackSpeed = template.baseAttackSpeed;
            gem.baseRange = template.baseRange;
            gem.gemColor = template.gemColor;
            gem.accentColor = template.accentColor;
            gem.glowColor = template.glowColor;
            gem.effectType = template.effectType;
            gem.effectValue = template.effectValue;
            gem.effectDuration = template.effectDuration;
            gem.effectRadius = template.effectRadius;

            return gem;
        }

        public bool PlaceGemAt(int x, int y)
        {
            if (currentState != GamePhase.Building) return false;
            if (placedGemsThisRound.Count >= GameConfig.GEMS_PER_ROUND) return false;

            if (!GridManager.Instance.CanPlaceAt(x, y)) return false;

            GemData gem = RollRandomGem();
            TowerController tower = GridManager.Instance.PlaceGem(x, y, gem);
            if (tower == null) return false;

            placedGemsThisRound.Add(tower);
            SelectTower(tower);

            if (placedGemsThisRound.Count >= GameConfig.GEMS_PER_ROUND)
            {
                SetState(GamePhase.Choosing);
            }

            return true;
        }

        public bool KeepGem(TowerController chosenTower)
        {
            if (currentState != GamePhase.Choosing) return false;
            if (!placedGemsThisRound.Contains(chosenTower)) return false;

            // Turn other 4 unchosen gems into stone slates
            for (int i = 0; i < placedGemsThisRound.Count; i++)
            {
                TowerController t = placedGemsThisRound[i];
                if (t != chosenTower)
                {
                    GridManager.Instance.TurnToSlate(t);
                }
            }

            placedGemsThisRound.Clear();
            SelectTower(chosenTower);
            StartWave();
            return true;
        }

        public bool RerollGems()
        {
            if (currentState != GamePhase.Choosing) return false;
            if (gold < GameConfig.REROLL_COST) return false;

            SpendGold(GameConfig.REROLL_COST);
            for (int i = 0; i < placedGemsThisRound.Count; i++)
            {
                GemData newGem = RollRandomGem();
                placedGemsThisRound[i].Initialize(placedGemsThisRound[i].tileX, placedGemsThisRound[i].tileY, newGem);
            }

            NotifyTowerStateChanged();
            return true;
        }

        public bool UpgradeChances()
        {
            if (chanceLevel >= GameConfig.CHANCE_UPGRADES.Length) return false;
            int cost = GameConfig.CHANCE_UPGRADES[chanceLevel].cost;
            if (gold < cost) return false;

            SpendGold(cost);
            chanceLevel++;
            return true;
        }

        public bool CombineTower(TowerController tower, CombinationResult combo)
        {
            if (tower == null || combo == null) return false;

            if (combo.type == CombinationResult.ComboType.Special)
            {
                // Create Special Tower
                GemData specialGem = combo.recipe.resultGem;
                if (specialGem == null)
                {
                    specialGem = ScriptableObject.CreateInstance<GemData>();
                    specialGem.gemName = combo.recipe.recipeName;
                    specialGem.isSpecial = true;
                    specialGem.specialName = combo.recipe.recipeName;
                    specialGem.baseDamage = 50f;
                    specialGem.baseAttackSpeed = 1.5f;
                    specialGem.baseRange = 5.0f;
                }

                tower.Initialize(tower.tileX, tower.tileY, specialGem);

                // Turn partners into slates
                for (int i = 0; i < combo.partnerTowers.Count; i++)
                {
                    GridManager.Instance.TurnToSlate(combo.partnerTowers[i]);
                }
            }
            else if (combo.type == CombinationResult.ComboType.Duplicate)
            {
                // Duplicate upgrade
                tower.gemData.quality = combo.duplicateTargetQuality;
                tower.gemData.baseDamage *= 1.8f;

                for (int i = 0; i < combo.partnerTowers.Count; i++)
                {
                    GridManager.Instance.TurnToSlate(combo.partnerTowers[i]);
                }
            }

            // If combined during Choosing phase with this turn's gems, finalize round
            if (currentState == GamePhase.Choosing && (placedGemsThisRound.Contains(tower) || combo.partnerTowers.Exists(p => placedGemsThisRound.Contains(p))))
            {
                for (int i = 0; i < placedGemsThisRound.Count; i++)
                {
                    TowerController t = placedGemsThisRound[i];
                    if (t != tower && !combo.partnerTowers.Contains(t))
                    {
                        GridManager.Instance.TurnToSlate(t);
                    }
                }
                placedGemsThisRound.Clear();
                StartWave();
            }

            NotifyTowerStateChanged();
            return true;
        }

        public void StartWave()
        {
            SetState(GamePhase.Wave);
            RecalculateAuras();

            if (waveCoroutine != null) StopCoroutine(waveCoroutine);
            waveCoroutine = StartCoroutine(SpawnWaveRoutine());
        }

        private IEnumerator SpawnWaveRoutine()
        {
            activeCreeps.Clear();
            WaveData waveData = GetCurrentWaveData();
            List<Vector2Int> path = GridManager.Instance.Pathfinding.CachedFullPath;

            for (int i = 0; i < waveData.count; i++)
            {
                CreepController creep = Instantiate(creepPrefab, transform);
                creep.Initialize(waveData, path, 1.0f + (currentWave - 1) * 0.15f);
                activeCreeps.Add(creep);

                yield return new WaitForSeconds(GameConfig.SPAWN_INTERVAL);
            }
        }

        public WaveData GetCurrentWaveData()
        {
            int idx = Mathf.Clamp(currentWave - 1, 0, waveDefinitions.Count - 1);
            if (waveDefinitions.Count > 0) return waveDefinitions[idx];

            WaveData defaultWave = ScriptableObject.CreateInstance<WaveData>();
            defaultWave.waveIndex = currentWave;
            defaultWave.waveName = $"Wave {currentWave}";
            defaultWave.count = 10;
            defaultWave.hp = 80f + currentWave * 45f;
            defaultWave.armor = currentWave * 1.5f;
            defaultWave.moveSpeed = 2.5f;
            return defaultWave;
        }

        public void OnCreepKilled(CreepController creep)
        {
            activeCreeps.Remove(creep);
            gold += 2;
            score += 20;
            OnGoldChanged?.Invoke(gold);
            CheckWaveCleared();
        }

        public void OnCreepReachedCastle(CreepController creep)
        {
            activeCreeps.Remove(creep);
            lives = Mathf.Max(0, lives - 1);
            OnLivesChanged?.Invoke(lives);

            if (lives <= 0)
            {
                SetState(GamePhase.GameOver);
            }
            else
            {
                CheckWaveCleared();
            }
        }

        private void CheckWaveCleared()
        {
            if (currentState == GamePhase.Wave && activeCreeps.Count == 0)
            {
                int waveClearBonus = 10 + currentWave * 2;
                gold += waveClearBonus;
                OnGoldChanged?.Invoke(gold);

                if (currentWave >= GameConfig.TOTAL_WAVES)
                {
                    SetState(GamePhase.Victory);
                }
                else
                {
                    currentWave++;
                    OnWaveChanged?.Invoke(currentWave);
                    SetState(GamePhase.Building);
                }
            }
        }

        public void RecalculateAuras()
        {
            List<TowerController> gems = GridManager.Instance.ActiveGems;
            for (int i = 0; i < gems.Count; i++)
            {
                gems[i].auraSpeedMultiplier = 1.0f;
                gems[i].auraDamageMultiplier = 1.0f;
                gems[i].auraRangeBonus = 0f;
            }

            for (int i = 0; i < gems.Count; i++)
            {
                TowerController src = gems[i];
                if (src.gemData == null) continue;

                if (src.gemData.effectType == "aura_speed")
                {
                    float bonus = src.gemData.effectValue > 0f ? src.gemData.effectValue : 0.2f;
                    float radius = src.gemData.effectRadius > 0f ? src.gemData.effectRadius : 4.0f;

                    for (int j = 0; j < gems.Count; j++)
                    {
                        if (gems[j] != src && Vector3.Distance(src.transform.position, gems[j].transform.position) <= radius)
                        {
                            gems[j].auraSpeedMultiplier += bonus;
                        }
                    }
                }
                else if (src.gemData.effectType == "global_speed_aura")
                {
                    float bonus = src.gemData.effectValue > 0f ? src.gemData.effectValue : 1.5f;
                    for (int j = 0; j < gems.Count; j++)
                    {
                        gems[j].auraSpeedMultiplier += bonus;
                    }
                }
            }
        }

        public void SpendGold(int amount)
        {
            gold = Mathf.Max(0, gold - amount);
            OnGoldChanged?.Invoke(gold);
        }

        public void HealLives(int amount)
        {
            lives = Mathf.Min(GameConfig.STARTING_LIVES, lives + amount);
            OnLivesChanged?.Invoke(lives);
        }

        public void NotifyTowerStateChanged()
        {
            RecalculateAuras();
            OnSelectionChanged?.Invoke(selectedTower);
        }

        private void SetState(GamePhase newState)
        {
            currentState = newState;
            OnStateChanged?.Invoke(currentState);
        }
    }
}
