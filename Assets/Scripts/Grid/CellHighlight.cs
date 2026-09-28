using UnityEngine;
using GemTD.Core;

namespace GemTD.Grid
{
    public class CellHighlight : MonoBehaviour
    {
        [SerializeField] private MeshRenderer indicatorRenderer;
        [SerializeField] private Material validMaterial;
        [SerializeField] private Material invalidMaterial;
        [SerializeField] private LayerMask groundLayer;

        private Vector2Int currentHoverGrid = new Vector2Int(-1, -1);
        private Camera mainCamera;

        private void Start()
        {
            mainCamera = Camera.main;
            if (indicatorRenderer != null)
            {
                indicatorRenderer.enabled = false;
            }
        }

        private void Update()
        {
            if (GameManager.Instance == null || GameManager.Instance.CurrentState != GamePhase.Building)
            {
                if (indicatorRenderer != null) indicatorRenderer.enabled = false;
                return;
            }

            Ray ray = mainCamera.ScreenPointToRay(Input.mousePosition);
            if (Physics.Raycast(ray, out RaycastHit hit, 200f, groundLayer))
            {
                Vector2Int gridPos = GridManager.Instance.WorldToGrid(hit.point);
                if (gridPos != currentHoverGrid)
                {
                    currentHoverGrid = gridPos;
                    UpdateIndicator();
                }
            }
            else
            {
                if (indicatorRenderer != null) indicatorRenderer.enabled = false;
                currentHoverGrid = new Vector2Int(-1, -1);
            }
        }

        private void UpdateIndicator()
        {
            if (indicatorRenderer == null) return;

            if (!GridManager.Instance.Pathfinding.IsInside(currentHoverGrid.x, currentHoverGrid.y))
            {
                indicatorRenderer.enabled = false;
                return;
            }

            indicatorRenderer.enabled = true;
            transform.position = GridManager.Instance.GridToWorld(currentHoverGrid.x, currentHoverGrid.y) + Vector3.up * 0.05f;

            bool canPlace = GridManager.Instance.CanPlaceAt(currentHoverGrid.x, currentHoverGrid.y);
            indicatorRenderer.material = canPlace ? validMaterial : invalidMaterial;
        }

        public Vector2Int CurrentHoverTile => currentHoverGrid;
    }
}
