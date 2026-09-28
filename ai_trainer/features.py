"""
Feature extraction utilities for converting Gem TD state to tensors.
"""

import math
import torch
import numpy as np
from ai_trainer.gem_env import BASE_GEM_CODES, BASE_GEM_STATS, SPECIAL_RECIPES, WAVES_DATA

def extract_state_features(env):
    """
    Extracts a 96-dimensional normalized feature vector from the current env state.
    """
    feats = []

    # 1. Global state (8 features)
    wave_idx = env.wave - 1
    w_data = WAVES_DATA[min(wave_idx, len(WAVES_DATA) - 1)]
    feats.append(env.wave / 50.0)
    feats.append(env.lives / 50.0)
    feats.append(min(env.gold / 500.0, 1.0))
    feats.append(env.chance_level / 6.0)
    feats.append(env.path_length / 400.0)
    feats.append(len(env.towers) / 50.0)
    feats.append(1.0 if w_data['flying'] else 0.0)
    feats.append(1.0 if w_data['boss'] else 0.0)

    # 2. 5 Rolled Gems (12 * 5 = 60 features)
    center_x, center_y = 16.0, 16.0
    for i in range(5):
        if i < len(env.current_round_gems):
            code, level = env.current_round_gems[i]
            coord = env.placed_coords_this_round[i] if i < len(env.placed_coords_this_round) else (16, 16)
            stats = BASE_GEM_STATS[code]

            # 8 one-hot for code
            one_hot = [1.0 if code == c else 0.0 for c in BASE_GEM_CODES]
            feats.extend(one_hot)

            # level / 5.0
            feats.append(level / 5.0)

            # DPS estimate
            dps = (stats['damage'][level] * stats['attack_speed'][level]) / 500.0
            feats.append(dps)

            # Distance to center
            dist = math.hypot(coord[0] - center_x, coord[1] - center_y) / 24.0
            feats.append(dist)

            # Path coverage estimate
            in_range = 0
            rng = stats['range'][level]
            for px, py in env.full_path:
                if math.hypot(coord[0] * 24 - px * 24, coord[1] * 24 - py * 24) <= rng:
                    in_range += 1
            feats.append(in_range / max(1, len(env.full_path)))
        else:
            feats.extend([0.0] * 12)

    # 3. Board Composition (16 features)
    # Count of each gem code (8 features)
    counts = {c: 0 for c in BASE_GEM_CODES}
    utility_counts = {'slow': 0, 'poison': 0, 'burn_aura': 0, 'anti_air': 0, 'splash': 0}
    for t in env.towers:
        code = t.get('code')
        if code in counts:
            counts[code] += 1
        eff = t.get('effect')
        if eff in utility_counts:
            utility_counts[eff] += 1

    for c in BASE_GEM_CODES:
        feats.append(counts[c] / 10.0)

    for u in ['slow', 'poison', 'burn_aura', 'anti_air', 'splash']:
        feats.append(utility_counts[u] / 5.0)

    # Recipe progress for Silver, Malachite, Asteriated Ruby (3 features)
    board_codes = set()
    for t in env.towers:
        board_codes.add(f"{t.get('code')}{t.get('level')}")

    for rec_name in ['Silver', 'Malachite', 'Asteriated Ruby']:
        rec = SPECIAL_RECIPES[rec_name]['recipe']
        have = sum(1 for req in rec if req in board_codes)
        feats.append(have / float(len(rec)))

    # 4. Recipe Availability Flags (10 features)
    avail_recipes = env.find_available_recipes()
    for rec_name in SPECIAL_RECIPES.keys():
        feats.append(1.0 if rec_name in avail_recipes else 0.0)

    # 5. Duplicate Availability (2 features: pair, quad)
    dup_upgrades = env.find_duplicate_upgrades()
    has_pair = any(d['type'] == 'pair' for d in dup_upgrades)
    has_quad = any(d['type'] == 'quad' for d in dup_upgrades)
    feats.append(1.0 if has_pair else 0.0)
    feats.append(1.0 if has_quad else 0.0)

    # 6. Shop & Tower Relocation Features (8 features)
    reloc_plan = env.get_best_relocation()
    feats.append(1.0 if env.can_relocate() else 0.0)
    feats.append(min(1.0, (reloc_plan[3] / 200.0) if reloc_plan else 0.0))
    feats.append(1.0 if env.can_heal_castle() else 0.0)
    feats.append(1.0 if env.can_buy_boss_trap() else 0.0)
    feats.append(min(env.gold / 100.0, 1.0))
    next_cost = 9999
    if env.chance_level < 6:
        from ai_trainer.gem_env import CHANCE_UPGRADES
        next_cost = CHANCE_UPGRADES[env.chance_level]['cost']
    feats.append(1.0 if env.gold >= next_cost else 0.0)
    feats.append(max(0.0, (35.0 - env.lives) / 35.0))
    feats.append(1.0 if w_data['boss'] else 0.0)

    return torch.tensor(feats, dtype=torch.float32).unsqueeze(0)


def get_action_mask(env):
    """
    Returns boolean mask of length 9 indicating which actions are currently legal:
    0-4: Keep gem 0..4 (always valid if 5 gems placed)
    5: Craft recipe (valid only if special recipe is craftable)
    6: Combine duplicate (valid only if duplicate pair/quad exists)
    7: Relocate Outer Tower to Central Killzone (valid if affordable & beneficial)
    8: Shop: Castle Repair or Boss Trap (valid if affordable & needed)
    """
    mask = [True, True, True, True, True, False, False, False, False]
    avail_recipes = env.find_available_recipes()
    if len(avail_recipes) > 0:
        mask[5] = True

    dup_upgrades = env.find_duplicate_upgrades()
    if len(dup_upgrades) > 0:
        mask[6] = True

    if env.get_best_relocation() is not None:
        mask[7] = True

    if env.can_heal_castle() or env.can_buy_boss_trap():
        mask[8] = True

    return mask
