using System;
using System.Collections.Generic;
using UnityEngine;
using GemTD.Core;

namespace GemTD.Towers
{
    [Serializable]
    public class RecipeDefinition
    {
        public string recipeName;
        public string tier; // Basic, Advanced, Master, Ultimate
        public string[] ingredients; // e.g. ["B1", "D1", "Y1"]
        public GemData resultGem;
        [TextArea(1, 3)]
        public string description;
    }

    [Serializable]
    public class CombinationResult
    {
        public enum ComboType { Special, Duplicate }

        public ComboType type;
        public string name;
        public RecipeDefinition recipe;
        public GemTypeCode duplicateCode;
        public GemQuality duplicateTargetQuality;
        public List<TowerController> partnerTowers = new List<TowerController>();
    }

    [CreateAssetMenu(fileName = "RecipeDatabase", menuName = "GemTD/Recipe Database")]
    public class RecipeDatabase : ScriptableObject
    {
        public List<RecipeDefinition> specialRecipes = new List<RecipeDefinition>();

        private void OnEnable()
        {
            if (specialRecipes == null || specialRecipes.Count == 0)
            {
                PopulateDefaultRecipes();
            }
        }

        public void PopulateDefaultRecipes()
        {
            specialRecipes = new List<RecipeDefinition>
            {
                // Basic Recipes
                new RecipeDefinition { recipeName = "Silver", tier = "Basic", ingredients = new[] { "B1", "D1", "Y1" }, description = "Slows enemies by 35%." },
                new RecipeDefinition { recipeName = "Malachite", tier = "Basic", ingredients = new[] { "E1", "G1", "Q1" }, description = "Split shot: hits 4 targets." },
                new RecipeDefinition { recipeName = "Asteriated Ruby", tier = "Basic", ingredients = new[] { "R2", "R1", "P1" }, description = "Burn aura: 80 dmg/sec nearby." },
                new RecipeDefinition { recipeName = "Jade", tier = "Basic", ingredients = new[] { "G3", "E3", "B2" }, description = "Rapid green bursts with long range." },
                new RecipeDefinition { recipeName = "Star Ruby", tier = "Basic", ingredients = new[] { "R3", "R2", "R1" }, description = "High single-target critical burn." },
                new RecipeDefinition { recipeName = "Bloodstone", tier = "Basic", ingredients = new[] { "Q2", "Q1", "R2" }, description = "Drains HP and shreds armor." },
                new RecipeDefinition { recipeName = "Dark Emerald", tier = "Basic", ingredients = new[] { "E2", "E1", "T2" }, description = "Violent AoE poison blast." },
                new RecipeDefinition { recipeName = "Gold", tier = "Basic", ingredients = new[] { "Y3", "Y2", "D2" }, description = "Extracts bonus gold on each strike." },
                new RecipeDefinition { recipeName = "Aquamarine", tier = "Basic", ingredients = new[] { "Q3", "B2", "B1" }, description = "Freezing ice shatter with slow." },
                new RecipeDefinition { recipeName = "Pink Diamond", tier = "Basic", ingredients = new[] { "D3", "D2", "Y2" }, description = "Massive pure physical damage." },

                // Advanced Recipes
                new RecipeDefinition { recipeName = "Uranium 238", tier = "Advanced", ingredients = new[] { "T3", "T2", "Silver" }, description = "Radiation aura that melts creep armor." },
                new RecipeDefinition { recipeName = "Paraiba Tourmaline", tier = "Advanced", ingredients = new[] { "Q4", "Q3", "Q2" }, description = "Fires 6 split arcane lasers." },
                new RecipeDefinition { recipeName = "Black Opal", tier = "Advanced", ingredients = new[] { "G4", "G3", "G2" }, description = "Multi-target lightning storm." },
                new RecipeDefinition { recipeName = "Yellow Sapphire", tier = "Advanced", ingredients = new[] { "B4", "T4", "Gold" }, description = "Haste aura: +30% attack speed to adjacent towers." },
                new RecipeDefinition { recipeName = "Red Diamond", tier = "Advanced", ingredients = new[] { "D4", "R4", "Asteriated Ruby" }, description = "Devastating splash physical crits." },
                new RecipeDefinition { recipeName = "Grey Jade", tier = "Advanced", ingredients = new[] { "G4", "E4", "Jade" }, description = "Aura granting +60 range to allies." },

                // Master & Ultimate Recipes
                new RecipeDefinition { recipeName = "Ehome", tier = "Master", ingredients = new[] { "Yellow Sapphire", "Grey Jade", "Black Opal" }, description = "Global aura: +150% attack speed to ALL towers on board." },
                new RecipeDefinition { recipeName = "Koh-i-Noor", tier = "Ultimate", ingredients = new[] { "Pink Diamond", "Red Diamond", "Uranium 238" }, description = "Godly jewel with screen-clearing beam." }
            };
        }

        public List<CombinationResult> FindCombinationsForTower(TowerController targetTower, List<TowerController> allTowers)
        {
            List<CombinationResult> results = new List<CombinationResult>();
            if (targetTower == null || targetTower.IsSlate) return results;

            string targetId = targetTower.GetIdentifier();

            // 1. Check Special Recipes
            for (int r = 0; r < specialRecipes.Count; r++)
            {
                RecipeDefinition def = specialRecipes[r];
                List<string> reqs = new List<string>(def.ingredients);

                if (!reqs.Contains(targetId)) continue;
                reqs.Remove(targetId);

                List<TowerController> partners = new List<TowerController>();
                bool possible = true;

                for (int i = 0; i < reqs.Count; i++)
                {
                    string reqCode = reqs[i];
                    TowerController match = null;

                    for (int t = 0; t < allTowers.Count; t++)
                    {
                        TowerController cand = allTowers[t];
                        if (cand == targetTower || cand.IsSlate || partners.Contains(cand)) continue;

                        if (cand.GetIdentifier() == reqCode)
                        {
                            match = cand;
                            break;
                        }
                    }

                    if (match != null)
                    {
                        partners.Add(match);
                    }
                    else
                    {
                        possible = false;
                        break;
                    }
                }

                if (possible)
                {
                    results.Add(new CombinationResult
                    {
                        type = CombinationResult.ComboType.Special,
                        name = def.recipeName,
                        recipe = def,
                        partnerTowers = partners
                    });
                }
            }

            // 2. Check Duplicate Upgrades (Pairs / Quads of identical gems)
            if (!targetTower.IsSpecial && (int)targetTower.Quality < (int)GemQuality.Perfect)
            {
                List<TowerController> matches = new List<TowerController>();
                for (int t = 0; t < allTowers.Count; t++)
                {
                    TowerController cand = allTowers[t];
                    if (cand == targetTower || cand.IsSlate) continue;

                    if (!cand.IsSpecial && cand.TypeCode == targetTower.TypeCode && cand.Quality == targetTower.Quality)
                    {
                        matches.Add(cand);
                    }
                }

                // If at least 1 identical partner exists, can combine into next quality tier!
                if (matches.Count >= 1)
                {
                    results.Add(new CombinationResult
                    {
                        type = CombinationResult.ComboType.Duplicate,
                        name = $"{targetTower.TypeCode} Upgrade to {(GemQuality)((int)targetTower.Quality + 1)}",
                        duplicateCode = targetTower.TypeCode,
                        duplicateTargetQuality = (GemQuality)((int)targetTower.Quality + 1),
                        partnerTowers = new List<TowerController> { matches[0] }
                    });
                }
            }

            return results;
        }
    }
}
