using UnityEngine;
using GemTD.Core;
using GemTD.Creeps;

namespace GemTD.Towers
{
    public class Projectile : MonoBehaviour
    {
        [SerializeField] private float speed = 18f;

        private CreepController target;
        private float damage;
        private string effectType;
        private float effectValue;
        private float effectDuration;
        private bool isCrit;
        private Color trailColor;

        public void Initialize(CreepController targetCreep, float dmg, string effect, float val, float dur, bool crit, Color color)
        {
            target = targetCreep;
            damage = dmg;
            effectType = effect;
            effectValue = val;
            effectDuration = dur;
            isCrit = crit;
            trailColor = color;
        }

        private void Update()
        {
            if (target == null || target.IsDead)
            {
                // Lost target: recycle
                Recycle();
                return;
            }

            Vector3 targetPos = target.transform.position + Vector3.up * 0.5f;
            Vector3 dir = targetPos - transform.position;
            float distThisFrame = speed * Time.deltaTime;

            if (dir.magnitude <= distThisFrame)
            {
                OnHit();
            }
            else
            {
                transform.position += dir.normalized * distThisFrame;
                transform.forward = dir.normalized;
            }
        }

        private void OnHit()
        {
            if (target != null && !target.IsDead)
            {
                target.TakeDamage(damage, true);

                // Apply Special On-Hit Effects
                if (effectType == "slow")
                {
                    target.ApplySlow(effectValue > 0 ? effectValue : 0.35f, effectDuration > 0 ? effectDuration : 3.0f);
                }
                else if (effectType == "burn")
                {
                    target.ApplyBurn(effectValue > 0 ? effectValue : 40f, effectDuration > 0 ? effectDuration : 3.0f);
                }
                else if (effectType == "poison")
                {
                    target.ApplyPoison(effectValue > 0 ? effectValue : 50f, effectDuration > 0 ? effectDuration : 4.0f);
                }
                else if (effectType == "stun")
                {
                    target.ApplyStun(effectValue > 0 ? effectValue : 1.5f);
                }

                if (ObjectPoolManager.Instance != null)
                {
                    ObjectPoolManager.Instance.SpawnHitVfx(transform.position, trailColor);
                }
            }

            Recycle();
        }

        private void Recycle()
        {
            if (ObjectPoolManager.Instance != null)
            {
                ObjectPoolManager.Instance.ReturnProjectile(this);
            }
            else
            {
                gameObject.SetActive(false);
            }
        }
    }
}
