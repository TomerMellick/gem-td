"""
Evaluation and Benchmark script for trained Gem TD RL Model.
Runs 50 full test games with greedy policy (no exploration) and logs detailed statistics.
"""

import sys
import time
import torch
import numpy as np
from ai_trainer.gem_env import GemTDEnv
from ai_trainer.models import GemDecisionNetwork
from ai_trainer.features import extract_state_features, get_action_mask
from ai_trainer.train_rl import select_best_maze_placements

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def evaluate(num_games=50, model_path='ai_trainer/models/gem_td_model.pt'):
    print("=" * 65)
    print("GEM TD - TRAINED RL MODEL BENCHMARK & EVALUATION")
    print(f"Games: {num_games} | Model Checkpoint: {model_path}")
    print("=" * 65)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = GemDecisionNetwork(input_dim=104, hidden_dim=128, num_actions=9).to(device)
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.eval()

    waves_reached = []
    recipes_crafted_list = []
    relocations_list = []
    shop_buys_list = []
    path_lengths = []
    scores = []
    victories = 0
    t0 = time.time()

    for game_idx in range(1, num_games + 1):
        env = GemTDEnv()
        env.check_upgrade_chance()
        ep_recipes = 0
        ep_relocs = 0
        ep_shops = 0

        while not env.game_over and not env.victory and env.wave <= 50:
            # 1. Place 5 strategic gems
            coords = select_best_maze_placements(env, count=5)
            if len(coords) < 5:
                break
            env.start_round()
            env.place_5_gems(coords)

            # 2. Model Decision (Greedy)
            state_tensor = extract_state_features(env).to(device)
            action_mask = get_action_mask(env)
            action, prob, value = model.get_action(state_tensor, action_mask=action_mask, epsilon=0.0)

            best_round_gem = 0
            best_lvl = -1
            for g_i, (_, lvl) in enumerate(env.current_round_gems):
                if lvl > best_lvl:
                    best_lvl = lvl
                    best_round_gem = g_i

            # 3. Execute
            if action in [0, 1, 2, 3, 4]:
                env.keep_gem(action)
            elif action == 5:
                avail = env.find_available_recipes()
                if avail:
                    env.craft_special_tower(avail[0])
                    ep_recipes += 1
                else:
                    env.keep_gem(best_round_gem)
            elif action == 6:
                dupes = env.find_duplicate_upgrades()
                if dupes:
                    env.combine_duplicate(dupes[0])
                else:
                    env.keep_gem(best_round_gem)
            elif action == 7:
                env.keep_gem(best_round_gem)
                reloc = env.get_best_relocation()
                if reloc:
                    env.relocate_tower(reloc[0], reloc[1], reloc[2])
                    ep_relocs += 1
            elif action == 8:
                env.keep_gem(best_round_gem)
                if env.can_heal_castle():
                    env.heal_castle()
                    ep_shops += 1
                elif env.can_buy_boss_trap():
                    env.buy_boss_trap()
                    ep_shops += 1

            # 4. Combat
            env.simulate_wave_combat()

            # 5. Shop Upgrade
            env.check_upgrade_chance()

        waves_reached.append(env.wave)
        recipes_crafted_list.append(ep_recipes)
        relocations_list.append(ep_relocs)
        shop_buys_list.append(ep_shops)
        path_lengths.append(env.path_length)
        scores.append(env.score)
        if env.victory:
            victories += 1

    elapsed = time.time() - t0
    print("\n--- BENCHMARK RESULTS ---")
    print(f"Total Games Played:     {num_games}")
    print(f"Evaluation Time:        {elapsed:.2f}s ({num_games / elapsed:.1f} games/sec)")
    print(f"Average Wave Reached:   {np.mean(waves_reached):.1f} / 50")
    print(f"Max Wave Reached:       {np.max(waves_reached)} / 50")
    print(f"Min Wave Reached:       {np.min(waves_reached)} / 50")
    print(f"Win Rate (Beaten 50):   {(victories / num_games) * 100:.1f}%")
    print(f"Avg Special Towers/Game:{np.mean(recipes_crafted_list):.2f}")
    print(f"Avg Relocations/Game:   {np.mean(relocations_list):.2f}")
    print(f"Avg Shop Buys/Game:     {np.mean(shop_buys_list):.2f}")
    print(f"Avg Creep Maze Path:    {np.mean(path_lengths):.1f} tiles (Baseline: 102.0)")
    print(f"Max Creep Maze Path:    {np.max(path_lengths):.1f} tiles")
    print(f"Avg Damage / Score:     {np.mean(scores):,.0f}")
    print("=" * 65)

if __name__ == '__main__':
    evaluate(50)
