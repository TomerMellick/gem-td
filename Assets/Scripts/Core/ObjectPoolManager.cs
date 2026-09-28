using System.Collections.Generic;
using UnityEngine;
using GemTD.Towers;

namespace GemTD.Core
{
    public class ObjectPoolManager : MonoBehaviour
    {
        public static ObjectPoolManager Instance { get; private set; }

        [Header("Prefabs")]
        [SerializeField] private Projectile projectilePrefab;
        [SerializeField] private GameObject floatingTextPrefab;
        [SerializeField] private GameObject hitVfxPrefab;

        private readonly Queue<Projectile> projectilePool = new Queue<Projectile>();
        private readonly Queue<GameObject> floatingTextPool = new Queue<GameObject>();
        private readonly Queue<GameObject> hitVfxPool = new Queue<GameObject>();

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        public Projectile SpawnProjectile(Vector3 position, Quaternion rotation)
        {
            Projectile p;
            if (projectilePool.Count > 0)
            {
                p = projectilePool.Dequeue();
                p.transform.position = position;
                p.transform.rotation = rotation;
                p.gameObject.SetActive(true);
            }
            else
            {
                p = Instantiate(projectilePrefab, position, rotation, transform);
            }
            return p;
        }

        public void ReturnProjectile(Projectile p)
        {
            p.gameObject.SetActive(false);
            projectilePool.Enqueue(p);
        }

        public GameObject SpawnFloatingText(Vector3 position, string text, Color color, float size = 1f)
        {
            GameObject obj;
            if (floatingTextPool.Count > 0)
            {
                obj = floatingTextPool.Dequeue();
                obj.transform.position = position;
                obj.gameObject.SetActive(true);
            }
            else
            {
                obj = Instantiate(floatingTextPrefab, position, Quaternion.identity, transform);
            }

            var textComponent = obj.GetComponent<TMPro.TextMeshPro>();
            if (textComponent != null)
            {
                textComponent.text = text;
                textComponent.color = color;
                textComponent.fontSize = size * 5f;
            }

            return obj;
        }

        public void ReturnFloatingText(GameObject obj)
        {
            obj.SetActive(false);
            floatingTextPool.Enqueue(obj);
        }

        public GameObject SpawnHitVfx(Vector3 position, Color color)
        {
            GameObject vfx;
            if (hitVfxPool.Count > 0)
            {
                vfx = hitVfxPool.Dequeue();
                vfx.transform.position = position;
                vfx.gameObject.SetActive(true);
            }
            else
            {
                vfx = Instantiate(hitVfxPrefab, position, Quaternion.identity, transform);
            }

            var ps = vfx.GetComponent<ParticleSystem>();
            if (ps != null)
            {
                var main = ps.main;
                main.startColor = color;
                ps.Play();
            }

            return vfx;
        }

        public void ReturnHitVfx(GameObject vfx)
        {
            vfx.SetActive(false);
            hitVfxPool.Enqueue(vfx);
        }
    }
}
