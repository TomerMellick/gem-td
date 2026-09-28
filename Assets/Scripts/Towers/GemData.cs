using System;
using UnityEngine;
using GemTD.Core;

namespace GemTD.Towers
{
    [CreateAssetMenu(fileName = "NewGemData", menuName = "GemTD/Gem Data")]
    public class GemData : ScriptableObject
    {
        [Header("Identity")]
        public string gemName = "Chipped Ruby";
        public string typeCode = "R"; // R, B, D, E, G, Q, T, Y or Special Tower Name
        public GemQuality quality = GemQuality.Chipped;
        public bool isSpecial = false;
        public string specialName = "";

        [Header("Combat Stats")]
        public float baseDamage = 15f;
        public float baseAttackSpeed = 1.0f; // attacks per second
        public float baseRange = 4.0f;       // in world units (1 cell = 1 unit)

        [Header("Visuals")]
        public Color gemColor = Color.red;
        public Color accentColor = Color.white;
        public Color glowColor = Color.yellow;
        public Sprite icon;
        public GameObject customMeshPrefab;

        [Header("Special Effect / Debuff / Aura")]
        public string effectType = "none"; // none, slow, burn, poison, stun, split, aura_speed, aura_damage, aura_range, global_speed_aura, etc.
        public float effectValue = 0f;
        public float effectDuration = 0f;
        public float effectRadius = 0f;

        [Header("Description & Lore")]
        [TextArea(2, 4)]
        public string description;
        [TextArea(2, 4)]
        public string lore;

        public string GetIdentifier()
        {
            if (isSpecial) return specialName;
            return $"{typeCode}{(int)quality}";
        }
    }
}
