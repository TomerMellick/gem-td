using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using GemTD.Core;
using GemTD.Grid;
using GemTD.Towers;

namespace GemTD.UI
{
    public class CodexUI : MonoBehaviour
    {
        [Header("Controls")]
        [SerializeField] private TMP_InputField searchInput;
        [SerializeField] private Transform recipeListParent;
        [SerializeField] private GameObject recipeEntryPrefab;
        [SerializeField] private Button closeBtn;

        [Header("Filter Buttons")]
        [SerializeField] private Button filterAllBtn;
        [SerializeField] private Button filterBasicBtn;
        [SerializeField] private Button filterAdvancedBtn;
        [SerializeField] private Button filterMasterBtn;

        private string activeFilter = "All";
        private string searchQuery = "";

        private void Start()
        {
            if (closeBtn != null) closeBtn.onClick.AddListener(() => gameObject.SetActive(false));
            if (searchInput != null) searchInput.onValueChanged.AddListener(OnSearchChanged);

            if (filterAllBtn != null) filterAllBtn.onClick.AddListener(() => SetFilter("All"));
            if (filterBasicBtn != null) filterBasicBtn.onClick.AddListener(() => SetFilter("Basic"));
            if (filterAdvancedBtn != null) filterAdvancedBtn.onClick.AddListener(() => SetFilter("Advanced"));
            if (filterMasterBtn != null) filterMasterBtn.onClick.AddListener(() => SetFilter("Master"));
        }

        private void OnEnable()
        {
            RefreshList();
        }

        private void SetFilter(string filter)
        {
            activeFilter = filter;
            RefreshList();
        }

        private void OnSearchChanged(string text)
        {
            searchQuery = text.ToLowerInvariant().Trim();
            RefreshList();
        }

        public void RefreshList()
        {
            if (recipeListParent == null || GameManager.Instance == null || GameManager.Instance.RecipeDatabase == null) return;

            // Clear old entries
            for (int i = recipeListParent.childCount - 1; i >= 0; i--)
            {
                Destroy(recipeListParent.GetChild(i).gameObject);
            }

            List<RecipeDefinition> recipes = GameManager.Instance.RecipeDatabase.specialRecipes;
            List<TowerController> boardGems = GridManager.Instance != null ? GridManager.Instance.ActiveGems : new List<TowerController>();

            // Collect existing gem identifiers on board
            HashSet<string> existingCodes = new HashSet<string>();
            for (int i = 0; i < boardGems.Count; i++)
            {
                existingCodes.Add(boardGems[i].GetIdentifier());
            }

            for (int i = 0; i < recipes.Count; i++)
            {
                RecipeDefinition def = recipes[i];

                // Filter check
                if (activeFilter != "All" && !def.tier.Equals(activeFilter, System.StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                // Search check
                if (!string.IsNullOrEmpty(searchQuery) && !def.recipeName.ToLowerInvariant().Contains(searchQuery))
                {
                    continue;
                }

                GameObject entry = Instantiate(recipeEntryPrefab, recipeListParent);

                var nameText = entry.transform.Find("Name")?.GetComponent<TextMeshProUGUI>();
                if (nameText != null) nameText.text = def.recipeName;

                var tierText = entry.transform.Find("Tier")?.GetComponent<TextMeshProUGUI>();
                if (tierText != null) tierText.text = def.tier;

                var descText = entry.transform.Find("Description")?.GetComponent<TextMeshProUGUI>();
                if (descText != null) descText.text = def.description;

                var ingredientsText = entry.transform.Find("Ingredients")?.GetComponent<TextMeshProUGUI>();
                if (ingredientsText != null)
                {
                    List<string> ingDisplay = new List<string>();
                    for (int j = 0; j < def.ingredients.Length; j++)
                    {
                        string code = def.ingredients[j];
                        bool hasOnBoard = existingCodes.Contains(code);
                        string colorTag = hasOnBoard ? "<color=#4ade80>✓ " : "<color=#94a3b8>• ";
                        ingDisplay.Add($"{colorTag}{code}</color>");
                    }
                    ingredientsText.text = string.Join("   ", ingDisplay);
                }
            }
        }
    }
}
