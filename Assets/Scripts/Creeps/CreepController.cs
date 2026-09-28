using System;
using System.Collections.Generic;
using UnityEngine;
using GemTD.Core;

namespace GemTD.Creeps
{
    public class CreepController : MonoBehaviour
    {
        [Header("Runtime State")]
        public float currentHp;
        public float maxHp;
        public float currentArmor;
        public float baseSpeed = 2.5f;

        private WaveData waveData;
        private List<Vector3> waypoints = new List<Vector3>();
        private int currentWaypointIndex = 0;
        private bool isDead = false;

        // Debuffs
        private float slowTimer = 0f;
        private float slowAmount = 0f;

        private float burnTimer = 0f;
        private float burnDps = 0f;

        private float poisonTimer = 0f;
        private float poisonDps = 0f;

        private float stunTimer = 0f;

        public bool IsDead => isDead;
        public int WaypointIndex => currentWaypointIndex;
        public float Progress => currentWaypointIndex + (waypoints.Count > 0 ? (float)currentWaypointIndex / waypoints.Count : 0f);

        public void Initialize(WaveData data, List<Vector2Int> gridPath, float hpMultiplier = 1.0f)
        {
            waveData = data;
            maxHp = data.hp * hpMultiplier;
            currentHp = maxHp;
            currentArmor = data.armor;
            baseSpeed = data.moveSpeed;
            isDead = false;

            slowTimer = 0f;
            burnTimer = 0f;
            poisonTimer = 0f;
            stunTimer = 0f;

            waypoints.Clear();
            for (int i = 0; i < gridPath.Count; i++)
            {
                waypoints.Add(new Vector3(gridPath[i].x * GameConfig.DEFAULT_TILE_SIZE, 0f, gridPath[i].y * GameConfig.DEFAULT_TILE_SIZE));
            }

            currentWaypointIndex = 0;
            if (waypoints.Count > 0)
            {
                transform.position = waypoints[0];
            }

            transform.localScale = Vector3.one * data.modelScale;
        }

        private void Update()
        {
            if (isDead) return;

            float dt = Time.deltaTime;

            // Handle Stun
            if (stunTimer > 0f)
            {
                stunTimer -= dt;
                return;
            }

            // Handle Burn
            if (burnTimer > 0f)
            {
                burnTimer -= dt;
                TakeDamage(burnDps * dt, false);
                if (isDead) return;
            }

            // Handle Poison
            if (poisonTimer > 0f)
            {
                poisonTimer -= dt;
                TakeDamage(poisonDps * dt, false);
                if (isDead) return;
            }

            // Handle Slow
            float effectiveSpeed = baseSpeed;
            if (slowTimer > 0f)
            {
                slowTimer -= dt;
                effectiveSpeed *= Mathf.Clamp01(1f - slowAmount);
            }

            // Move along path
            if (currentWaypointIndex < waypoints.Count)
            {
                Vector3 target = waypoints[currentWaypointIndex];
                Vector3 dir = target - transform.position;
                float dist = dir.magnitude;

                if (dist <= effectiveSpeed * dt)
                {
                    transform.position = target;
                    currentWaypointIndex++;

                    // Reached Gem Castle!
                    if (currentWaypointIndex >= waypoints.Count)
                    {
                        OnReachCastle();
                    }
                }
                else
                {
                    transform.position += dir.normalized * (effectiveSpeed * dt);
                    if (dir != Vector3.zero)
                    {
                        transform.forward = dir.normalized;
                    }
                }
            }
        }

        public void TakeDamage(float amount, bool showFloatingText = true)
        {
            if (isDead) return;

            // Armor damage reduction formula: DamageReduction = (armor * 0.05) / (1 + 0.05 * armor)
            float reduction = (currentArmor * 0.05f) / (1f + 0.05f * Mathf.Abs(currentArmor));
            float finalDamage = Mathf.Max(1f, amount * (1f - reduction));

            currentHp -= finalDamage;

            if (showFloatingText && ObjectPoolManager.Instance != null)
            {
                ObjectPoolManager.Instance.SpawnFloatingText(transform.position + Vector3.up * 1.2f, Mathf.RoundToInt(finalDamage).ToString(), Color.white, 0.8f);
            }

            if (currentHp <= 0f)
            {
                Die();
            }
        }

        public void ApplySlow(float percent, float duration)
        {
            if (waveData != null && waveData.trait == CreepTrait.Immune) return;
            if (percent > slowAmount || slowTimer <= 0f)
            {
                slowAmount = percent;
            }
            slowTimer = Mathf.Max(slowTimer, duration);
        }

        public void ApplyBurn(float dps, float duration)
        {
            burnDps = Mathf.Max(burnDps, dps);
            burnTimer = Mathf.Max(burnTimer, duration);
        }

        public void ApplyPoison(float dps, float duration)
        {
            poisonDps = Mathf.Max(poisonDps, dps);
            poisonTimer = Mathf.Max(poisonTimer, duration);
        }

        public void ApplyStun(float duration)
        {
            if (waveData != null && waveData.trait == CreepTrait.Immune) return;
            stunTimer = Mathf.Max(stunTimer, duration);
        }

        private void Die()
        {
            isDead = true;
            if (ObjectPoolManager.Instance != null)
            {
                ObjectPoolManager.Instance.SpawnHitVfx(transform.position, Color.yellow);
            }
            GameManager.Instance.OnCreepKilled(this);
            gameObject.SetActive(false);
        }

        private void OnReachCastle()
        {
            isDead = true;
            GameManager.Instance.OnCreepReachedCastle(this);
            gameObject.SetActive(false);
        }
    }
}
