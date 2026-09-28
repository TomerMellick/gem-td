using UnityEngine;

namespace GemTD.Creeps
{
    public enum CreepTrait
    {
        Normal,
        Flying,
        Armored,
        Fast,
        Boss,
        Immune
    }

    [CreateAssetMenu(fileName = "WaveData", menuName = "GemTD/Wave Data")]
    public class WaveData : ScriptableObject
    {
        public int waveIndex = 1;
        public string waveName = "Goblin Scouts";
        public int count = 10;
        public float hp = 80f;
        public float armor = 0f;
        public float moveSpeed = 2.5f; // world units per sec
        public CreepTrait trait = CreepTrait.Normal;

        public Color creepColor = new Color(0.4f, 0.8f, 0.4f);
        public float modelScale = 1.0f;
        public GameObject customModelPrefab;
    }
}
