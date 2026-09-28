using UnityEngine;

namespace GemTD.Shop
{
    [CreateAssetMenu(fileName = "NewRuneData", menuName = "GemTD/Rune Data")]
    public class RuneData : ScriptableObject
    {
        public string runeId = "haste";
        public string runeName = "Rune of Swiftness";
        public int cost = 45;
        public Sprite icon;
        public Color runeColor = Color.cyan;

        [Header("Stat Modifiers")]
        public float attackSpeedBonus = 0f;    // e.g. +0.35 (+35%)
        public float damageBonus = 0f;         // e.g. +0.40 (+40%)
        public float rangeBonus = 0f;          // e.g. +1.5 world units
        public float critChance = 0f;          // e.g. 0.20 (20%)
        public float critMultiplier = 1.0f;    // e.g. 2.5x
        public bool trueStrike = false;

        [Header("Applied On-Hit Effects")]
        public float slowPercent = 0f;
        public float slowDuration = 0f;
        public float poisonDps = 0f;
        public float poisonDuration = 0f;
        public float bonusGoldChance = 0f;
        public int bonusGoldAmount = 0;

        [TextArea(2, 3)]
        public string description;
    }
}
