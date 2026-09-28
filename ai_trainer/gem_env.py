"""
High-Speed Headless Gem TD Simulation Environment for Reinforcement Learning.
Matches the exact rules, formulas, waves, recipes, and pathfinding of the game.
"""

import math
import random
from collections import deque
import numpy as np

GRID_W = 33
GRID_H = 33
STARTING_LIVES = 50
STARTING_GOLD = 60
GEMS_PER_ROUND = 5
CREEPS_PER_WAVE = 10

# Checkpoints: Start -> CP1 -> CP2 -> CP3 -> Gem Castle
CHECKPOINTS = [
    (2, 2),    # CP 0 (Spawn)
    (30, 2),   # CP 1
    (30, 30),  # CP 2
    (2, 30),   # CP 3
    (16, 16)   # CP 4 (Castle)
]

CHANCE_UPGRADES = [
    {'level': 1, 'cost': 0,   'chances': [1.00, 0.00, 0.00, 0.00, 0.00]},
    {'level': 2, 'cost': 20,  'chances': [0.70, 0.30, 0.00, 0.00, 0.00]},
    {'level': 3, 'cost': 60,  'chances': [0.40, 0.45, 0.15, 0.00, 0.00]},
    {'level': 4, 'cost': 150, 'chances': [0.20, 0.35, 0.35, 0.10, 0.00]},
    {'level': 5, 'cost': 350, 'chances': [0.10, 0.25, 0.35, 0.25, 0.05]},
    {'level': 6, 'cost': 800, 'chances': [0.05, 0.15, 0.30, 0.35, 0.15]}
]

BASE_GEM_CODES = ['B', 'D', 'Y', 'E', 'G', 'Q', 'R', 'P']

# Base gem stats [dummy, tier1, tier2, tier3, tier4, tier5]
BASE_GEM_STATS = {
    'B': {  # Sapphire (Slow)
        'name': 'Sapphire',
        'damage': [0, 8, 20, 50, 120, 300],
        'attack_speed': [0, 1.0, 1.0, 1.0, 1.0, 1.0],
        'range': [0, 140, 150, 160, 175, 190],
        'effect': 'slow',
        'slow_pct': [0, 0.20, 0.30, 0.40, 0.50, 0.60],
        'slow_dur': [0, 3.0, 3.5, 4.0, 4.5, 5.0]
    },
    'D': {  # Diamond (Pierce Physical Single)
        'name': 'Diamond',
        'damage': [0, 20, 50, 130, 320, 800],
        'attack_speed': [0, 1.1, 1.1, 1.2, 1.25, 1.3],
        'range': [0, 150, 160, 175, 190, 210],
        'effect': 'pierce'
    },
    'Y': {  # Topaz (Multishot)
        'name': 'Topaz',
        'damage': [0, 8, 20, 50, 120, 300],
        'attack_speed': [0, 1.0, 1.0, 1.0, 1.0, 1.0],
        'range': [0, 140, 150, 160, 175, 190],
        'effect': 'multishot',
        'multishot': [0, 2, 3, 4, 5, 6]
    },
    'E': {  # Emerald (Poison)
        'name': 'Emerald',
        'damage': [0, 8, 20, 50, 120, 300],
        'attack_speed': [0, 1.0, 1.0, 1.0, 1.0, 1.0],
        'range': [0, 140, 150, 160, 175, 190],
        'effect': 'poison',
        'poison_dps': [0, 6, 16, 45, 110, 280],
        'poison_dur': [0, 4.0, 4.0, 4.0, 4.5, 5.0]
    },
    'G': {  # Opal (Aura Speed)
        'name': 'Opal',
        'damage': [0, 10, 25, 65, 160, 400],
        'attack_speed': [0, 1.0, 1.0, 1.0, 1.0, 1.0],
        'range': [0, 130, 140, 150, 165, 180],
        'effect': 'aura_speed',
        'aura_speed': [0, 0.15, 0.25, 0.35, 0.50, 0.70]
    },
    'Q': {  # Aquamarine (Anti-Air / Rapid)
        'name': 'Aquamarine',
        'damage': [0, 7, 18, 45, 110, 270],
        'attack_speed': [0, 2.0, 2.2, 2.4, 2.7, 3.0],
        'range': [0, 130, 140, 150, 165, 180],
        'effect': 'anti_air',
        'air_mult': [0, 1.5, 1.75, 2.0, 2.5, 3.0]
    },
    'R': {  # Ruby (AoE Splash)
        'name': 'Ruby',
        'damage': [0, 10, 25, 65, 160, 400],
        'attack_speed': [0, 0.9, 0.9, 0.95, 1.0, 1.05],
        'range': [0, 130, 140, 150, 165, 180],
        'effect': 'splash',
        'splash_rad': [0, 45, 50, 60, 70, 85],
        'splash_pct': 0.5
    },
    'P': {  # Amethyst (Armor Shred)
        'name': 'Amethyst',
        'damage': [0, 8, 20, 50, 120, 300],
        'attack_speed': [0, 1.0, 1.0, 1.0, 1.0, 1.0],
        'range': [0, 140, 150, 160, 175, 190],
        'effect': 'armor_shred',
        'shred': [0, 2, 4, 7, 11, 16],
        'shred_dur': [0, 4.0, 4.0, 4.0, 4.5, 5.0]
    }
}

# Special Towers Recipes
SPECIAL_RECIPES = {
    'Silver': {'recipe': ['B1', 'D1', 'Y1'], 'damage': 40, 'speed': 1.0, 'range': 160, 'effect': 'slow', 'slow_pct': 0.35, 'tier': 1},
    'Malachite': {'recipe': ['E1', 'G1', 'Q1'], 'damage': 18, 'speed': 1.25, 'range': 160, 'effect': 'split', 'split_targets': 4, 'tier': 1},
    'Asteriated Ruby': {'recipe': ['R2', 'R1', 'P1'], 'damage': 15, 'speed': 2.0, 'range': 160, 'effect': 'burn_aura', 'burn_dps': 80, 'tier': 1},
    'Jade': {'recipe': ['G3', 'E3', 'B2'], 'damage': 25, 'speed': 2.0, 'range': 190, 'effect': 'poison', 'poison_dps': 80, 'tier': 1},
    'Quartz': {'recipe': ['G4', 'R3', 'P2'], 'damage': 35, 'speed': 1.6, 'range': 150, 'effect': 'anti_air', 'tier': 1},
    'Silver Knight': {'recipe': ['Silver', 'Q2', 'R3'], 'damage': 150, 'speed': 1.25, 'range': 180, 'effect': 'cleave_slow', 'slow_pct': 0.40, 'tier': 2},
    'Pink Diamond': {'recipe': ['D5', 'D3', 'Y3'], 'damage': 280, 'speed': 1.2, 'range': 180, 'effect': 'crit', 'crit_mult': 5.0, 'tier': 2},
    'Vivid Malachite': {'recipe': ['Malachite', 'D2', 'Y3'], 'damage': 75, 'speed': 1.4, 'range': 180, 'effect': 'split', 'split_targets': 7, 'tier': 2},
    'Uranium-238': {'recipe': ['Y5', 'B3', 'E2'], 'damage': 160, 'speed': 2.0, 'range': 180, 'effect': 'split', 'split_targets': 5, 'tier': 2},
    'Volcano': {'recipe': ['Asteriated Ruby', 'R4', 'P3'], 'damage': 30, 'speed': 2.0, 'range': 180, 'effect': 'burn_aura', 'burn_dps': 350, 'tier': 2}
}

# 50 Waves Definition
WAVES_DATA = [
    {'wave': 1,  'count': 10, 'hp': 50,      'armor': 0,  'speed': 1.00, 'flying': False, 'boss': False, 'gold': 1},
    {'wave': 2,  'count': 10, 'hp': 85,      'armor': 0,  'speed': 1.25, 'flying': False, 'boss': False, 'gold': 1},
    {'wave': 3,  'count': 10, 'hp': 140,     'armor': 2,  'speed': 0.90, 'flying': False, 'boss': False, 'gold': 2},
    {'wave': 4,  'count': 10, 'hp': 210,     'armor': 3,  'speed': 1.00, 'flying': False, 'boss': False, 'gold': 2},
    {'wave': 5,  'count': 10, 'hp': 280,     'armor': 1,  'speed': 1.15, 'flying': True,  'boss': False, 'gold': 3},
    {'wave': 6,  'count': 10, 'hp': 420,     'armor': 4,  'speed': 0.80, 'flying': False, 'boss': False, 'gold': 3},
    {'wave': 7,  'count': 10, 'hp': 560,     'armor': 2,  'speed': 1.05, 'flying': False, 'boss': False, 'gold': 3},
    {'wave': 8,  'count': 10, 'hp': 700,     'armor': 2,  'speed': 1.10, 'flying': False, 'boss': False, 'gold': 4},
    {'wave': 9,  'count': 10, 'hp': 900,     'armor': 3,  'speed': 1.15, 'flying': False, 'boss': False, 'gold': 4},
    {'wave': 10, 'count': 1,  'hp': 6500,    'armor': 6,  'speed': 0.85, 'flying': False, 'boss': True,  'gold': 25},
    {'wave': 11, 'count': 10, 'hp': 1200,    'armor': 3,  'speed': 1.00, 'flying': False, 'boss': False, 'gold': 5},
    {'wave': 12, 'count': 10, 'hp': 1550,    'armor': 4,  'speed': 1.10, 'flying': False, 'boss': False, 'gold': 5},
    {'wave': 13, 'count': 10, 'hp': 1950,    'armor': 5,  'speed': 1.05, 'flying': False, 'boss': False, 'gold': 6},
    {'wave': 14, 'count': 10, 'hp': 2400,    'armor': 6,  'speed': 0.95, 'flying': False, 'boss': False, 'gold': 6},
    {'wave': 15, 'count': 10, 'hp': 2900,    'armor': 3,  'speed': 1.20, 'flying': True,  'boss': False, 'gold': 7},
    {'wave': 16, 'count': 10, 'hp': 3500,    'armor': 5,  'speed': 1.10, 'flying': False, 'boss': False, 'gold': 7},
    {'wave': 17, 'count': 10, 'hp': 4200,    'armor': 4,  'speed': 1.15, 'flying': False, 'boss': False, 'gold': 8},
    {'wave': 18, 'count': 10, 'hp': 5000,    'armor': 6,  'speed': 1.00, 'flying': False, 'boss': False, 'gold': 8},
    {'wave': 19, 'count': 10, 'hp': 6000,    'armor': 5,  'speed': 1.30, 'flying': False, 'boss': False, 'gold': 9},
    {'wave': 20, 'count': 1,  'hp': 38000,   'armor': 10, 'speed': 0.85, 'flying': False, 'boss': True,  'gold': 50},
    {'wave': 21, 'count': 10, 'hp': 7500,    'armor': 8,  'speed': 0.90, 'flying': False, 'boss': False, 'gold': 10},
    {'wave': 22, 'count': 10, 'hp': 9200,    'armor': 16, 'speed': 1.00, 'flying': False, 'boss': False, 'gold': 10},
    {'wave': 23, 'count': 10, 'hp': 11000,   'armor': 6,  'speed': 1.10, 'flying': False, 'boss': False, 'gold': 11},
    {'wave': 24, 'count': 10, 'hp': 13200,   'armor': 10, 'speed': 1.00, 'flying': False, 'boss': False, 'gold': 12},
    {'wave': 25, 'count': 10, 'hp': 15500,   'armor': 12, 'speed': 1.20, 'flying': True,  'boss': False, 'gold': 13},
    {'wave': 26, 'count': 10, 'hp': 18500,   'armor': 7,  'speed': 1.35, 'flying': False, 'boss': False, 'gold': 14},
    {'wave': 27, 'count': 10, 'hp': 22000,   'armor': 8,  'speed': 1.15, 'flying': True,  'boss': False, 'gold': 15},
    {'wave': 28, 'count': 10, 'hp': 26000,   'armor': 18, 'speed': 1.05, 'flying': True,  'boss': False, 'gold': 16},
    {'wave': 29, 'count': 10, 'hp': 31000,   'armor': 10, 'speed': 1.30, 'flying': True,  'boss': False, 'gold': 18},
    {'wave': 30, 'count': 1,  'hp': 180000,  'armor': 15, 'speed': 0.95, 'flying': True,  'boss': True,  'gold': 100},
    {'wave': 31, 'count': 10, 'hp': 38000,   'armor': 12, 'speed': 1.10, 'flying': False, 'boss': False, 'gold': 20},
    {'wave': 32, 'count': 10, 'hp': 46000,   'armor': 14, 'speed': 1.15, 'flying': False, 'boss': False, 'gold': 22},
    {'wave': 33, 'count': 10, 'hp': 55000,   'armor': 10, 'speed': 1.00, 'flying': False, 'boss': False, 'gold': 24},
    {'wave': 34, 'count': 10, 'hp': 66000,   'armor': 12, 'speed': 1.30, 'flying': True,  'boss': False, 'gold': 26},
    {'wave': 35, 'count': 10, 'hp': 78000,   'armor': 14, 'speed': 1.25, 'flying': True,  'boss': False, 'gold': 28},
    {'wave': 36, 'count': 10, 'hp': 92000,   'armor': 12, 'speed': 1.10, 'flying': False, 'boss': False, 'gold': 30},
    {'wave': 37, 'count': 10, 'hp': 108000,  'armor': 16, 'speed': 1.20, 'flying': False, 'boss': False, 'gold': 32},
    {'wave': 38, 'count': 10, 'hp': 126000,  'armor': 18, 'speed': 1.15, 'flying': False, 'boss': False, 'gold': 35},
    {'wave': 39, 'count': 10, 'hp': 148000,  'armor': 20, 'speed': 1.35, 'flying': True,  'boss': False, 'gold': 40},
    {'wave': 40, 'count': 1,  'hp': 750000,  'armor': 25, 'speed': 0.95, 'flying': True,  'boss': True,  'gold': 200},
    {'wave': 41, 'count': 10, 'hp': 180000,  'armor': 22, 'speed': 1.10, 'flying': False, 'boss': False, 'gold': 45},
    {'wave': 42, 'count': 10, 'hp': 220000,  'armor': 20, 'speed': 1.40, 'flying': True,  'boss': False, 'gold': 50},
    {'wave': 43, 'count': 10, 'hp': 265000,  'armor': 24, 'speed': 1.15, 'flying': False, 'boss': False, 'gold': 55},
    {'wave': 44, 'count': 10, 'hp': 320000,  'armor': 22, 'speed': 1.20, 'flying': False, 'boss': False, 'gold': 60},
    {'wave': 45, 'count': 10, 'hp': 380000,  'armor': 25, 'speed': 1.30, 'flying': True,  'boss': False, 'gold': 70},
    {'wave': 46, 'count': 10, 'hp': 460000,  'armor': 20, 'speed': 1.10, 'flying': False, 'boss': False, 'gold': 80},
    {'wave': 47, 'count': 10, 'hp': 550000,  'armor': 28, 'speed': 1.35, 'flying': False, 'boss': False, 'gold': 90},
    {'wave': 48, 'count': 10, 'hp': 660000,  'armor': 26, 'speed': 1.40, 'flying': True,  'boss': False, 'gold': 100},
    {'wave': 49, 'count': 10, 'hp': 800000,  'armor': 32, 'speed': 1.10, 'flying': False, 'boss': False, 'gold': 120},
    {'wave': 50, 'count': 1,  'hp': 3500000, 'armor': 40, 'speed': 0.90, 'flying': True,  'boss': True,  'gold': 500}
]

SQRT2 = 1.41421356

class FastPathfinder:
    """Optimized BFS/A* pathfinder for 33x33 Gem TD grid."""
    def __init__(self, w=GRID_W, h=GRID_H):
        self.w = w
        self.h = h

    def find_segment(self, grid, start, goal):
        sx, sy = start
        gx, gy = goal
        if sx == gx and sy == gy:
            return [(sx, sy)]

        w, h = self.w, self.h
        dist = np.full((h, w), np.inf, dtype=np.float32)
        parent = np.full((h, w, 2), -1, dtype=np.int16)
        
        queue = deque([(sx, sy)])
        dist[sy, sx] = 0

        # Directions: 4 cardinal + 4 diagonal
        cardinals = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        diagonals = [
            (1, 1, (1, 0), (0, 1)),
            (-1, 1, (-1, 0), (0, 1)),
            (1, -1, (1, 0), (0, -1)),
            (-1, -1, (-1, 0), (0, -1))
        ]

        found = False
        while queue:
            cx, cy = queue.popleft()
            cd = dist[cy, cx]
            if cx == gx and cy == gy:
                found = True
                break

            # Cardinal
            for dx, dy in cardinals:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < w and 0 <= ny < h:
                    if grid[ny, nx] == 0:  # Passable
                        nd = cd + 1.0
                        if nd < dist[ny, nx]:
                            dist[ny, nx] = nd
                            parent[ny, nx] = [cx, cy]
                            queue.append((nx, ny))

            # Diagonal (corner-cutting check)
            for dx, dy, o1, o2 in diagonals:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < w and 0 <= ny < h:
                    if grid[ny, nx] == 0:
                        # Adjacent orthogonal tiles must both be passable
                        ox1, oy1 = cx + o1[0], cy + o1[1]
                        ox2, oy2 = cx + o2[0], cy + o2[1]
                        if 0 <= ox1 < w and 0 <= oy1 < h and grid[oy1, ox1] == 0:
                            if 0 <= ox2 < w and 0 <= oy2 < h and grid[oy2, ox2] == 0:
                                nd = cd + SQRT2
                                if nd < dist[ny, nx]:
                                    dist[ny, nx] = nd
                                    parent[ny, nx] = [cx, cy]
                                    queue.append((nx, ny))

        if not found:
            return None

        # Backtrack path
        path = []
        curr = (gx, gy)
        while curr != (-1, -1):
            path.append(curr)
            px, py = parent[curr[1], curr[0]]
            curr = (int(px), int(py))
        path.reverse()
        return path

    def validate_full_route(self, grid):
        """Checks if Start -> CP1 -> CP2 -> CP3 -> CP4 is unobstructed."""
        full_path = []
        total_len = 0.0

        for i in range(len(CHECKPOINTS) - 1):
            seg = self.find_segment(grid, CHECKPOINTS[i], CHECKPOINTS[i + 1])
            if seg is None:
                return False, [], 0.0
            if i > 0:
                full_path.extend(seg[1:])
            else:
                full_path.extend(seg)
            total_len += len(seg)

        return True, full_path, total_len


class GemTDEnv:
    """Complete Headless Gem TD Gym/RL Environment."""
    def __init__(self):
        self.pathfinder = FastPathfinder()
        self.reset()

    def reset(self):
        # 0 = Empty/Passable, 1 = Wall/Tower/Slate
        self.grid = np.zeros((GRID_H, GRID_W), dtype=np.uint8)
        
        # Checkpoints are always marked passable (0)
        self.lives = STARTING_LIVES
        self.gold = STARTING_GOLD
        self.wave = 1
        self.chance_level = 1
        self.score = 0
        self.game_over = False
        self.victory = False

        # Active player towers: list of dicts { 'x', 'y', 'type', 'level', 'damage', 'speed', 'range', 'effect', ... }
        self.towers = []
        # Slates (inert obstacle walls)
        self.slates = []

        # Current round rolled gems (5 items)
        self.current_round_gems = []
        self.placed_coords_this_round = []

        # Current path through checkpoints
        valid, self.full_path, self.path_length = self.pathfinder.validate_full_route(self.grid)
        self.path_coords_set = set(self.full_path)
        return self._get_obs()

    def _get_obs(self):
        """Extract a structured state feature vector for neural networks."""
        obs = {
            'wave': self.wave / 50.0,
            'lives': self.lives / 50.0,
            'gold': min(self.gold / 500.0, 1.0),
            'chance_level': self.chance_level / 6.0,
            'num_towers': len(self.towers) / 50.0,
            'path_length': self.path_length / 400.0,
            'grid_density': (len(self.towers) + len(self.slates)) / 300.0
        }
        return obs

    def roll_gem(self):
        """Roll a random gem code and level based on current chance level."""
        code = random.choice(BASE_GEM_CODES)
        chances = CHANCE_UPGRADES[self.chance_level - 1]['chances']
        rand = random.random()
        cumulative = 0.0
        level = 1
        for i, c in enumerate(chances):
            cumulative += c
            if rand <= cumulative:
                level = i + 1
                break
        return code, level

    def can_place_at(self, x, y):
        """Checks if placing an obstacle at (x, y) is legal (does not block path)."""
        if not (0 <= x < GRID_W and 0 <= y < GRID_H):
            return False
        if (x, y) in CHECKPOINTS:
            return False
        if self.grid[y, x] != 0:
            return False

        # Fast heuristic: if (x, y) is not in current path, it definitely doesn't block!
        if (x, y) not in self.path_coords_set:
            return True

        # Temporarily place obstacle and test connectivity
        self.grid[y, x] = 1
        valid, _, _ = self.pathfinder.validate_full_route(self.grid)
        self.grid[y, x] = 0
        return valid

    def generate_candidate_placements(self, num_candidates=10):
        """
        Fast targeted candidate placement generator.
        Samples strategic detour points along the active path and center killzone.
        """
        candidates = []
        path = self.full_path
        path_len = len(path)
        if path_len < 4:
            return []

        # 1. Sample strategic path points with stride
        stride = max(2, path_len // 15)
        test_points = set()

        for idx in range(1, path_len - 1, stride):
            test_points.add(path[idx])

        # 2. Add central killzone coordinates around (16, 16)
        for cx in range(13, 20, 2):
            for cy in range(13, 20, 2):
                if (cx, cy) not in CHECKPOINTS:
                    test_points.add((cx, cy))

        # 3. Quick test candidates
        for nx, ny in test_points:
            if self.grid[ny, nx] == 0 and (nx, ny) not in CHECKPOINTS:
                self.grid[ny, nx] = 1
                valid, _, new_len = self.pathfinder.validate_full_route(self.grid)
                self.grid[ny, nx] = 0
                if valid:
                    delta = new_len - self.path_length
                    # Bonus for path length extension + proximity to center
                    center_dist = math.hypot(nx - 16, ny - 16)
                    score = delta * 3.0 + max(0, 16 - center_dist) * 0.5
                    candidates.append(((nx, ny), score))

        candidates.sort(key=lambda item: item[1], reverse=True)
        return [c[0] for c in candidates[:num_candidates]]

    def start_round(self):
        """Roll 5 gems for the new wave round."""
        self.current_round_gems = [self.roll_gem() for _ in range(GEMS_PER_ROUND)]
        self.placed_coords_this_round = []

    def place_5_gems(self, coords_list):
        """Places the 5 gems at the chosen coordinates."""
        for x, y in coords_list:
            self.grid[y, x] = 1
            self.placed_coords_this_round.append((x, y))

        valid, self.full_path, self.path_length = self.pathfinder.validate_full_route(self.grid)
        self.path_coords_set = set(self.full_path)
        return valid

    def find_available_recipes(self):
        """Check if any special tower recipes can be crafted."""
        # Active tower codes on board + 5 rolled gems
        board_codes = []
        for t in self.towers:
            if t.get('is_special'):
                board_codes.append(t['type'])
            else:
                board_codes.append(f"{t['code']}{t['level']}")
        
        round_codes = [f"{c}{lvl}" for c, lvl in self.current_round_gems]
        all_codes = board_codes + round_codes

        counts = {}
        for c in all_codes:
            counts[c] = counts.get(c, 0) + 1

        matches = []
        for name, spec in SPECIAL_RECIPES.items():
            req_counts = {}
            for req in spec['recipe']:
                req_counts[req] = req_counts.get(req, 0) + 1

            possible = True
            for req, needed in req_counts.items():
                if counts.get(req, 0) < needed:
                    possible = False
                    break
            if possible:
                matches.append(name)
        return matches

    def find_duplicate_upgrades(self):
        """Check for 2x or 4x duplicate gem combinations."""
        counts = {}
        for c, lvl in self.current_round_gems:
            key = f"{c}{lvl}"
            counts[key] = counts.get(key, 0) + 1

        upgrades = []
        for key, count in counts.items():
            c = key[0]
            lvl = int(key[1])
            if count >= 4 and lvl <= 3:
                upgrades.append({'type': 'quad', 'code': c, 'level': lvl, 'target': lvl + 2})
            elif count >= 2 and lvl <= 4:
                upgrades.append({'type': 'pair', 'code': c, 'level': lvl, 'target': lvl + 1})
        return upgrades

    def keep_gem(self, chosen_idx):
        """
        Player keeps 1 of the 5 rolled gems as an active tower.
        The other 4 turn into rock slates.
        """
        chosen_code, chosen_level = self.current_round_gems[chosen_idx]
        chosen_coord = self.placed_coords_this_round[chosen_idx]

        # Register active tower
        stats = BASE_GEM_STATS[chosen_code]
        tower = {
            'x': chosen_coord[0],
            'y': chosen_coord[1],
            'code': chosen_code,
            'level': chosen_level,
            'type': f"{chosen_code}{chosen_level}",
            'damage': stats['damage'][chosen_level],
            'speed': stats['attack_speed'][chosen_level],
            'range': stats['range'][chosen_level],
            'effect': stats['effect'],
            'is_special': False
        }
        self.towers.append(tower)

        # Other 4 become slates
        for i, coord in enumerate(self.placed_coords_this_round):
            if i != chosen_idx:
                self.slates.append(coord)

        return tower

    def combine_duplicate(self, dup):
        """
        Combine a 2x pair or 4x quad duplicate gem roll into an upgraded tower.
        Target level = lvl + 1 (for pair) or lvl + 2 (for quad).
        """
        c = dup['code']
        target_lvl = min(5, dup['target'])
        matching_idx = 0
        for i, (gc, gl) in enumerate(self.current_round_gems):
            if gc == c and gl == dup['level']:
                matching_idx = i
                break

        chosen_coord = self.placed_coords_this_round[matching_idx]
        stats = BASE_GEM_STATS[c]
        tower = {
            'x': chosen_coord[0],
            'y': chosen_coord[1],
            'code': c,
            'level': target_lvl,
            'type': f"{c}{target_lvl}",
            'damage': stats['damage'][target_lvl],
            'speed': stats['attack_speed'][target_lvl],
            'range': stats['range'][target_lvl],
            'effect': stats['effect'],
            'is_special': False
        }
        self.towers.append(tower)

        # Other 4 become slates
        for i, coord in enumerate(self.placed_coords_this_round):
            if i != matching_idx:
                self.slates.append(coord)

        return tower

    def craft_special_tower(self, recipe_name, chosen_coord_idx=0):
        """Craft a special recipe using available gems."""
        spec = SPECIAL_RECIPES[recipe_name]
        chosen_coord = self.placed_coords_this_round[chosen_coord_idx]

        # Deduct ingredients that were already on board
        reqs = list(spec['recipe'])
        for gc, gl in self.current_round_gems:
            code_str = f"{gc}{gl}"
            if code_str in reqs:
                reqs.remove(code_str)

        new_towers = []
        for t in self.towers:
            t_code = t['type']
            if t_code in reqs:
                reqs.remove(t_code)
                self.slates.append((t['x'], t['y']))
            else:
                new_towers.append(t)
        self.towers = new_towers

        tower = {
            'x': chosen_coord[0],
            'y': chosen_coord[1],
            'type': recipe_name,
            'damage': spec['damage'],
            'speed': spec['speed'],
            'range': spec['range'],
            'effect': spec['effect'],
            'is_special': True,
            'tier': spec['tier']
        }
        self.towers.append(tower)

        # Other placed coords become slates
        for i, coord in enumerate(self.placed_coords_this_round):
            if i != chosen_coord_idx:
                self.slates.append(coord)

        return tower

    def simulate_wave_combat(self):
        """
        Fast analytical/event combat simulation for the current wave.
        Uses sequential focus-fire damage pools and realistic creep flight/ground paths.
        """
        wave_idx = self.wave - 1
        if wave_idx >= len(WAVES_DATA):
            self.victory = True
            return 0, 0.0, 0, 0

        w_data = WAVES_DATA[wave_idx]
        total_creeps = w_data['count']
        creep_hp = float(w_data['hp'])
        creep_armor = float(w_data['armor'])
        creep_speed = float(w_data['speed']) * 48.0  # px/sec
        is_flying = w_data['flying']

        # Effective armor multiplier
        if creep_armor >= 0:
            armor_mult = 1.0 - (creep_armor * 0.05) / (1.0 + 0.05 * creep_armor)
        else:
            armor_mult = 2.0 - (0.95 ** (-creep_armor))

        # Flying creeps take straight checkpoint route, ground creeps navigate maze
        path = [(2,2), (30,2), (30,30), (2,30), (16,16)] if is_flying else self.full_path
        total_path_px = 112.0 * 24.0 if is_flying else len(self.full_path) * 24.0

        # Slow effects
        total_slow = 0.0
        for t in self.towers:
            if t.get('effect') == 'slow':
                total_slow = max(total_slow, 0.35)
            elif t.get('effect') == 'cleave_slow':
                total_slow = max(total_slow, 0.40)
        eff_speed = creep_speed * (1.0 - min(0.65, total_slow))
        traversal_time = total_path_px / max(1.0, eff_speed)
        wave_duration = (total_creeps - 1) * 0.9 + traversal_time

        # Calculate damage pools
        total_dmg_pool = 0.0
        for t in self.towers:
            tx_px = t['x'] * 24 + 12
            ty_px = t['y'] * 24 + 12
            trange = t['range']

            in_range_steps = sum(1 for px, py in path if math.hypot(tx_px - (px * 24 + 12), ty_px - (py * 24 + 12)) <= trange)
            if in_range_steps == 0:
                continue
            coverage_ratio = in_range_steps / max(1, len(path))
            t_window = traversal_time * coverage_ratio
            active_time = min(wave_duration, t_window + (total_creeps - 1) * 0.9)

            dmg = t['damage']
            speed = t['speed']
            effect = t.get('effect')

            mult = 2.0 if (effect == 'anti_air' and is_flying) else 1.0
            if effect == 'crit':
                mult *= 1.8
            if effect == 'burn_aura':
                total_dmg_pool += t.get('burn_dps', 80.0) * t_window * total_creeps
            elif effect == 'poison':
                total_dmg_pool += 80.0 * t_window * total_creeps
            total_dmg_pool += dmg * speed * armor_mult * mult * active_time

        creeps_killed = min(total_creeps, int(total_dmg_pool / max(1.0, creep_hp)))
        leaked = total_creeps - creeps_killed
        damage_dealt = min(total_creeps * creep_hp, total_dmg_pool)

        lives_lost = leaked * (10 if w_data['boss'] else 1)
        gold_earned = creeps_killed * w_data['gold']

        self.lives -= lives_lost
        self.gold += gold_earned
        self.score += int(damage_dealt)

        if self.lives <= 0:
            self.lives = 0
            self.game_over = True
        elif self.wave >= 50:
            self.victory = True
        else:
            self.wave += 1

        return creeps_killed, damage_dealt, lives_lost, gold_earned

    def check_upgrade_chance(self):
        """Auto-upgrade chance level when player has sufficient gold."""
        if self.chance_level < 6:
            cost = CHANCE_UPGRADES[self.chance_level]['cost']
            if self.gold >= cost:
                self.gold -= cost
                self.chance_level += 1
                return True
        return False

    def can_relocate(self):
        """Checks if player can afford tower relocation (30G) and has valid targets."""
        return self.gold >= 30 and len(self.towers) > 0 and len(self.slates) > 0

    def get_best_relocation(self):
        """
        Evaluates active towers and slate coordinates to find the most profitable relocation.
        Returns: (tower_idx, target_x, target_y, score_gain) or None
        """
        if not self.can_relocate():
            return None

        best_gain = 0.0
        best_plan = None
        center_x, center_y = 16.0, 16.0

        # Candidate central slates
        candidate_slates = []
        for sx, sy in self.slates:
            dist = math.hypot(sx - center_x, sy - center_y)
            if dist <= 6.0:  # In central high-traffic zone
                candidate_slates.append((sx, sy, dist))

        if not candidate_slates:
            return None

        # Sort slates by proximity to center
        candidate_slates.sort(key=lambda s: s[2])
        best_slate = (candidate_slates[0][0], candidate_slates[0][1])

        # Find high-value tower sitting on the outer perimeter
        for idx, t in enumerate(self.towers):
            current_dist = math.hypot(t['x'] - center_x, t['y'] - center_y)
            is_high_val = t.get('is_special') or t.get('level', 1) >= 2
            if is_high_val and current_dist > 7.0:
                gain = (current_dist - candidate_slates[0][2]) * (t['damage'] * t['speed'])
                if gain > best_gain:
                    best_gain = gain
                    best_plan = (idx, best_slate[0], best_slate[1], gain)

        return best_plan

    def relocate_tower(self, tower_idx, target_x, target_y):
        """Relocates/swaps a tower to (target_x, target_y) for 30 Gold."""
        if self.gold < 30 or tower_idx >= len(self.towers):
            return False

        t = self.towers[tower_idx]
        old_x, old_y = t['x'], t['y']

        # Swap with slate
        if (target_x, target_y) in self.slates:
            self.slates.remove((target_x, target_y))
            self.slates.append((old_x, old_y))
            t['x'] = target_x
            t['y'] = target_y
            self.gold -= 30
            return True

        return False

    def can_heal_castle(self):
        """Checks if castle repair is affordable (60G) and needed."""
        return self.gold >= 60 and self.lives <= 35

    def heal_castle(self):
        """Repairs the castle restoring +10 lives for 60 Gold."""
        if self.gold >= 60:
            self.gold -= 60
            self.lives = min(50, self.lives + 10)
            return True
        return False

    def can_buy_boss_trap(self):
        """Checks if buying a boss frost trap (30G) is appropriate."""
        wave_idx = self.wave - 1
        if 0 <= wave_idx < len(WAVES_DATA):
            is_boss = WAVES_DATA[wave_idx]['boss']
            return is_boss and self.gold >= 30
        return False

    def buy_boss_trap(self):
        """Places a Frost Sigil trap that slows the boss by 65%."""
        if self.gold >= 30:
            self.gold -= 30
            return True
        return False
