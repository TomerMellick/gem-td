using System;
using System.Collections.Generic;
using UnityEngine;
using GemTD.Core;
using GemTD.Creeps;
using GemTD.Shop;

namespace GemTD.Towers
{
    public class TowerController : MonoBehaviour
    {
        public enum TargetPriority
        {
            FirstAlongPath,
            LowestHp,
            HighestHp,
            Closest
        }

        [Header("Grid Position")]
        public int tileX;
        public int tileY;

        [Header("Tower Identity")]
        public GemData gemData;
        public bool isSlate = false;
        public TargetPriority priority = TargetPriority.FirstAlongPath;

        [Header("Runtime Stats")]
        public float cooldown = 0f;
        public int killCount = 0;
        public float totalDamageDealt = 0f;

        [Header("Aura Buffs from Other Towers")]
        public float auraSpeedMultiplier = 1.0f;
        public float auraDamageMultiplier = 1.0f;
        public float auraRangeBonus = 0f;

        [Header("Socketed Runes")]
        public List<RuneData> socketedRunes = new List<RuneData>();

        // Properties for recipe checks
        public bool IsSlate => isSlate;
        public bool IsSpecial => gemData != null && gemData.isSpecial;
        public string SpecialName => gemData != null ? gemData.specialName : "";
        public GemTypeCode TypeCode => gemData != null ? (GemTypeCode)Enum.Parse(typeof(GemTypeCode), gemData.typeCode) : GemTypeCode.R;
        public GemQuality Quality => gemData != null ? gemData.quality : GemQuality.Chipped;
        public string TowerName => isSlate ? "Rock Slate" : (gemData != null ? gemData.gemName : "Tower");

        public string GetIdentifier()
        {
            if (isSlate) return "SLATE";
            if (gemData == null) return "NONE";
            return gemData.GetIdentifier();
        }

        public void Initialize(int x, int y, GemData data)
        {
            tileX = x;
            tileY = y;
            gemData = data;
            isSlate = false;
            cooldown = 0f;
            killCount = 0;
            totalDamageDealt = 0f;
            socketedRunes.Clear();
            transform.position = new Vector3(x * GameConfig.DEFAULT_TILE_SIZE, 0f, y * GameConfig.DEFAULT_TILE_SIZE);
        }

        public void TurnIntoSlate()
        {
            isSlate = true;
            gemData = null;
            socketedRunes.Clear();
        }

        public float GetEffectiveDamage()
        {
            if (isSlate || gemData == null) return 0f;
            float dmg = gemData.baseDamage;

            // Rune bonuses
            float runeBonus = 0f;
            for (int i = 0; i < socketedRunes.Count; i++)
            {
                runeBonus += socketedRunes[i].damageBonus;
            }

            return dmg * (1f + runeBonus) * auraDamageMultiplier;
        }

        public float GetEffectiveAttackSpeed()
        {
            if (isSlate || gemData == null) return 0f;
            float spd = gemData.baseAttackSpeed;

            float runeBonus = 0f;
            for (int i = 0; i < socketedRunes.Count; i++)
            {
                runeBonus += socketedRunes[i].attackSpeedBonus;
            }

            return spd * (1f + runeBonus) * auraSpeedMultiplier;
        }

        public float GetEffectiveRange()
        {
            if (isSlate || gemData == null) return 0f;
            float rng = gemData.baseRange;

            float runeBonus = 0f;
            for (int i = 0; i < socketedRunes.Count; i++)
            {
                runeBonus += socketedRunes[i].rangeBonus;
            }

            return rng + runeBonus + auraRangeBonus;
        }

        public void UpdateCombat(float dt, List<CreepController> creeps)
        {
            if (isSlate || gemData == null) return;

            if (cooldown > 0f)
            {
                cooldown -= dt;
            }

            // Continuous Aura Damage (e.g. Asteriated Ruby)
            if (gemData.effectType == "burn_aura" && gemData.effectRadius > 0f)
            {
                float radius = gemData.effectRadius;
                for (int i = 0; i < creeps.Count; i++)
                {
                    CreepController c = creeps[i];
                    if (c != null && !c.IsDead)
                    {
                        if (Vector3.Distance(transform.position, c.transform.position) <= radius)
                        {
                            c.ApplyBurn(gemData.effectValue, 0.25f);
                        }
                    }
                }
            }

            // Attack Ready
            if (cooldown <= 0f)
            {
                CreepController target = AcquireTarget(creeps);
                if (target != null)
                {
                    FireAt(target);
                    float attacksPerSec = GetEffectiveAttackSpeed();
                    cooldown = attacksPerSec > 0f ? 1f / attacksPerSec : 1f;
                }
            }
        }

        private CreepController AcquireTarget(List<CreepController> creeps)
        {
            float range = GetEffectiveRange();
            CreepController best = null;
            float bestMetric = -1f;

            for (int i = 0; i < creeps.Count; i++)
            {
                CreepController c = creeps[i];
                if (c == null || c.IsDead) continue;

                float dist = Vector3.Distance(transform.position, c.transform.position);
                if (dist > range) continue;

                switch (priority)
                {
                    case TargetPriority.FirstAlongPath:
                        if (c.Progress > bestMetric)
                        {
                            bestMetric = c.Progress;
                            best = c;
                        }
                        break;

                    case TargetPriority.LowestHp:
                        if (best == null || c.currentHp < bestMetric)
                        {
                            bestMetric = c.currentHp;
                            best = c;
                        }
                        break;

                    case TargetPriority.HighestHp:
                        if (c.currentHp > bestMetric)
                        {
                            bestMetric = c.currentHp;
                            best = c;
                        }
                        break;

                    case TargetPriority.Closest:
                        if (best == null || dist < bestMetric)
                        {
                            bestMetric = dist;
                            best = c;
                        }
                        break;
                }
            }

            return best;
        }

        private void FireAt(CreepController target)
        {
            if (ObjectPoolManager.Instance == null) return;

            Vector3 spawnPos = transform.position + Vector3.up * 1f;
            Projectile p = ObjectPoolManager.Instance.SpawnProjectile(spawnPos, Quaternion.identity);

            float damage = GetEffectiveDamage();
            bool isCrit = false;

            // Check crit from runes
            for (int i = 0; i < socketedRunes.Count; i++)
            {
                if (socketedRunes[i].critChance > 0f && UnityEngine.Random.value < socketedRunes[i].critChance)
                {
                    damage *= socketedRunes[i].critMultiplier;
                    isCrit = true;
                    break;
                }
            }

            totalDamageDealt += damage;

            p.Initialize(
                target,
                damage,
                gemData.effectType,
                gemData.effectValue,
                gemData.effectDuration,
                isCrit,
                gemData.gemColor
            );
        }

        public bool CanSocketRune()
        {
            return !isSlate && socketedRunes.Count < GameConfig.MAX_TOWER_RUNES;
        }

        public bool SocketRune(RuneData rune)
        {
            if (!CanSocketRune() || rune == null) return false;
            socketedRunes.Add(rune);
            return true;
        }
    }
}
