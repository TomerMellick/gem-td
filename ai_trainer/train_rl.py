"""
Reinforcement Learning Training Script for Gem TD.
Uses Deep Q-Learning / Actor-Critic with Experience Replay and Action Masking.
"""

import os
import sys
import json
import time
import random
from collections import deque
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

from ai_trainer.gem_env import GemTDEnv, SPECIAL_RECIPES
from ai_trainer.models import GemDecisionNetwork
from ai_trainer.features import extract_state_features, get_action_mask

# Hyperparameters
NUM_EPISODES = 400
BATCH_SIZE = 64
GAMMA = 0.98
LR = 0.0008
EPS_START = 0.90
EPS_END = 0.05
EPS_DECAY = 0.995
TARGET_UPDATE = 10
MEMORY_SIZE = 10000

class ReplayBuffer:
    def __init__(self, capacity=MEMORY_SIZE):
        self.buffer = deque(maxlen=capacity)

    def push(self, state, action, reward, next_state, done, mask):
        self.buffer.append((state, action, reward, next_state, done, mask))

    def sample(self, batch_size):
        batch = random.sample(self.buffer, batch_size)
        states, actions, rewards, next_states, dones, masks = zip(*batch)
        return (
            torch.cat(states),
            torch.tensor(actions, dtype=torch.long),
            torch.tensor(rewards, dtype=torch.float32),
            torch.cat(next_states),
            torch.tensor(dones, dtype=torch.float32),
            masks
        )

    def __len__(self):
        return len(self.buffer)


# Spiral Labyrinth concentric rings with alternating entry gates
def generate_spiral_template():
    def build_ring(min_c, max_c, gate_coord):
        coords = []
        for x in range(min_c, max_c + 1):
            if (x, min_c) != gate_coord: coords.append((x, min_c))
        for y in range(min_c, max_c + 1):
            if (max_c, y) != gate_coord: coords.append((max_c, y))
        for x in range(max_c, min_c - 1, -1):
            if (x, max_c) != gate_coord: coords.append((x, max_c))
        for y in range(max_c, min_c - 1, -1):
            if (min_c, y) != gate_coord: coords.append((min_c, y))
        seen = set()
        res = []
        for c in coords:
            if c not in seen:
                seen.add(c)
                res.append(c)
        return res

    r1 = build_ring(13, 19, (16, 13)) # gate at top (16, 13)
    r2 = build_ring(10, 22, (16, 22)) # gate at bottom (16, 22)
    r3 = build_ring(7, 25, (16, 7))   # gate at top (16, 7)
    r4 = build_ring(4, 28, (16, 28))  # gate at bottom (16, 28)
    return r1 + r2 + r3 + r4

SPIRAL_MAZE_TEMPLATE = generate_spiral_template()


def select_best_maze_placements(env, count=5):
    """
    Intelligent Spiral Labyrinth maze coordinator.
    Prioritizes concentric ring barrier slots that force creeps into expansive detours,
    combined with greedy detour verification for maximum path length.
    """
    chosen = []
    # Test spiral ring slots first
    for x, y in SPIRAL_MAZE_TEMPLATE:
        if env.can_place_at(x, y):
            chosen.append((x, y))
            env.grid[y, x] = 1
            if len(chosen) >= count:
                break

    # If more needed, dynamically pick from active path candidates
    if len(chosen) < count:
        stride = max(1, len(env.full_path) // 15)
        for i in range(1, len(env.full_path) - 1, stride):
            x, y = env.full_path[i]
            if (x, y) not in chosen and env.can_place_at(x, y):
                chosen.append((x, y))
                env.grid[y, x] = 1
                if len(chosen) >= count:
                    break

    # Restore temporary grid flags
    for x, y in chosen:
        env.grid[y, x] = 0

    return chosen[:count]


if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def train():
    print("=" * 60)
    print("GEM TD - REINFORCEMENT LEARNING TRAINING (DEEP MAZING)")
    print(f"Episodes: {NUM_EPISODES} | Batch: {BATCH_SIZE} | LR: {LR}")
    print("=" * 60)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")

    policy_net = GemDecisionNetwork(input_dim=104, hidden_dim=128, num_actions=9).to(device)
    target_net = GemDecisionNetwork(input_dim=104, hidden_dim=128, num_actions=9).to(device)

    # Continue training from existing trained checkpoint
    model_checkpoint = 'ai_trainer/models/gem_td_model.pt'
    if os.path.exists(model_checkpoint):
        try:
            policy_net.load_state_dict(torch.load(model_checkpoint, map_location=device))
            print(f"Loaded existing model checkpoint from {model_checkpoint} to continue training!", flush=True)
        except Exception as e:
            print(f"Starting fresh model (could not load: {e})", flush=True)

    target_net.load_state_dict(policy_net.state_dict())
    target_net.eval()

    optimizer = optim.AdamW(policy_net.parameters(), lr=LR, weight_decay=1e-4)
    criterion = nn.SmoothL1Loss()
    memory = ReplayBuffer(MEMORY_SIZE)

    # Start with focused exploration since model already knows fundamentals
    epsilon = 0.30
    best_wave = 0
    total_victories = 0
    start_time = time.time()

    recent_waves = deque(maxlen=50)
    recent_rewards = deque(maxlen=50)
    recent_path_lens = deque(maxlen=50)
    recent_relocs = deque(maxlen=50)
    recent_shops = deque(maxlen=50)

    for episode in range(1, NUM_EPISODES + 1):
        env = GemTDEnv()
        env.check_upgrade_chance()  # Invest starting gold into Chance Level 2
        state_tensor = extract_state_features(env).to(device)
        ep_reward = 0.0
        recipes_crafted = 0
        ep_relocs = 0
        ep_shops = 0

        while not env.game_over and not env.victory and env.wave <= 50:
            initial_path_len = env.path_length

            # 1. Mazing Phase: Select 5 candidate coordinates
            coords = select_best_maze_placements(env, count=5)
            if len(coords) < 5:
                break

            # Start round & place 5 gems
            env.start_round()
            env.place_5_gems(coords)

            # --- Heavy Weight on Maze Planning ---
            path_gain = env.path_length - initial_path_len
            maze_reward = path_gain * 4.0  # Large immediate reward for every tile gained

            # Continuous labyrinth quality reward per wave
            if env.path_length > 102.0:
                maze_reward += (env.path_length - 100.0) * 0.5

            # Deep maze milestone bonuses
            if env.path_length >= 120 and initial_path_len < 120:
                maze_reward += 20.0
            if env.path_length >= 140 and initial_path_len < 140:
                maze_reward += 35.0
            if env.path_length >= 170 and initial_path_len < 170:
                maze_reward += 50.0
            if env.path_length >= 200 and initial_path_len < 200:
                maze_reward += 80.0

            # 2. Gem Selection / Action Phase
            action_mask = get_action_mask(env)
            action, prob, value = policy_net.get_action(state_tensor, action_mask=action_mask, epsilon=epsilon)

            # Execute action with integrated maze rewards
            best_round_gem = 0
            best_lvl = -1
            for g_i, (_, lvl) in enumerate(env.current_round_gems):
                if lvl > best_lvl:
                    best_lvl = lvl
                    best_round_gem = g_i

            reward = maze_reward
            if action in [0, 1, 2, 3, 4]:
                # Keep gem
                tower = env.keep_gem(action)
                # Reward for higher quality gems
                reward += tower['level'] * 3.0
                # Tower placement quality: bonus for central killzone coverage
                dist_to_center = ((tower['x'] - 16.0)**2 + (tower['y'] - 16.0)**2)**0.5
                if dist_to_center <= 6.0:
                    reward += 6.0
            elif action == 5:
                # Craft Special Recipe
                avail_recipes = env.find_available_recipes()
                if avail_recipes:
                    rec_name = avail_recipes[0]
                    env.craft_special_tower(rec_name, chosen_coord_idx=best_round_gem)
                    recipes_crafted += 1
                    reward += 35.0  # Big bonus for special tower!
                else:
                    env.keep_gem(best_round_gem)
            elif action == 6:
                # Duplicate Combine
                dup_upgrades = env.find_duplicate_upgrades()
                if dup_upgrades:
                    env.combine_duplicate(dup_upgrades[0])
                    reward += 25.0  # Upgrade combination bonus
                else:
                    env.keep_gem(best_round_gem)
            elif action == 7:
                # Relocate Outer Tower to Central Killzone
                env.keep_gem(best_round_gem)
                reloc = env.get_best_relocation()
                if reloc:
                    env.relocate_tower(reloc[0], reloc[1], reloc[2])
                    ep_relocs += 1
                    reward += 30.0 + min(20.0, reloc[3] / 8.0)
            elif action == 8:
                # Shop: Castle Repair or Boss Trap
                env.keep_gem(best_round_gem)
                if env.can_heal_castle():
                    env.heal_castle()
                    ep_shops += 1
                    reward += 30.0  # Critical save for castle lives!
                elif env.can_buy_boss_trap():
                    env.buy_boss_trap()
                    ep_shops += 1
                    reward += 20.0  # Slowing boss is key to victory!

            # 3. Wave Combat Simulation
            creeps_killed, dmg_dealt, lives_lost, gold_earned = env.simulate_wave_combat()

            # Wave rewards
            reward += (creeps_killed * 2.5)
            reward -= (lives_lost * 2.5)

            if env.wave == 25:
                reward += 100.0  # Major milestone reward for reaching Wave 25!
            elif env.wave == 35:
                reward += 150.0  # Wave 35 milestone!

            if env.victory:
                reward += 200.0
                total_victories += 1
            elif env.game_over:
                reward -= 40.0
            else:
                reward += 10.0  # Wave cleared bonus

            # Auto chance upgrade
            if env.check_upgrade_chance():
                reward += 6.0

            ep_reward += reward
            next_state_tensor = extract_state_features(env).to(device)
            done = env.game_over or env.victory

            # Store in replay buffer
            memory.push(state_tensor, action, reward, next_state_tensor, done, action_mask)
            state_tensor = next_state_tensor

            # Training step
            if len(memory) >= BATCH_SIZE:
                b_states, b_actions, b_rewards, b_next_states, b_dones, b_masks = memory.sample(BATCH_SIZE)
                b_states = b_states.to(device)
                b_actions = b_actions.to(device)
                b_rewards = b_rewards.to(device)
                b_next_states = b_next_states.to(device)
                b_dones = b_dones.to(device)

                # Current Q-values
                q_eval, _ = policy_net(b_states)
                q_val = q_eval.gather(1, b_actions.unsqueeze(1)).squeeze(1)

                # Target Q-values
                with torch.no_grad():
                    q_next, _ = target_net(b_next_states)
                    # Mask invalid next actions
                    for idx, mask in enumerate(b_masks):
                        for a_idx, valid in enumerate(mask):
                            if not valid:
                                q_next[idx, a_idx] = -1e9
                    q_target_max = q_next.max(1)[0]
                    q_target = b_rewards + (1.0 - b_dones) * GAMMA * q_target_max

                loss = criterion(q_val, q_target)
                optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(policy_net.parameters(), max_norm=1.0)
                optimizer.step()

        # Episode stats tracking
        wave_reached = env.wave
        best_wave = max(best_wave, wave_reached)
        recent_waves.append(wave_reached)
        recent_rewards.append(ep_reward)
        recent_path_lens.append(env.path_length)
        recent_relocs.append(ep_relocs)
        recent_shops.append(ep_shops)

        # Decay exploration epsilon
        epsilon = max(EPS_END, epsilon * EPS_DECAY)

        if episode % TARGET_UPDATE == 0:
            target_net.load_state_dict(policy_net.state_dict())

        # Logging
        if episode % 20 == 0 or episode == NUM_EPISODES:
            avg_wave = np.mean(recent_waves)
            avg_rew = np.mean(recent_rewards)
            avg_path = np.mean(recent_path_lens)
            avg_reloc = np.mean(recent_relocs)
            avg_shop = np.mean(recent_shops)
            elapsed = time.time() - start_time
            print(f"[{episode:4d}/{NUM_EPISODES}] Avg Wave: {avg_wave:.1f} | Best Wave: {best_wave:2d} | Avg Path: {avg_path:.1f} | Relocs: {avg_reloc:.1f} | Shop: {avg_shop:.1f} | Avg Rew: {avg_rew:6.1f} | Eps: {epsilon:.3f} | {elapsed:.1f}s", flush=True)

    # Save trained PyTorch model
    os.makedirs('ai_trainer/models', exist_ok=True)
    model_path = 'ai_trainer/models/gem_td_model.pt'
    torch.save(policy_net.state_dict(), model_path)
    print(f"\nModel checkpoint successfully saved to {model_path}", flush=True)
    print(f"Training finished in {time.time() - start_time:.2f} seconds.", flush=True)
    print(f"Total Victories: {total_victories} | All-time Best Wave: {best_wave}", flush=True)

    # Export weights for browser usage
    export_browser_weights(policy_net, 'js/ai_weights.json')
    return policy_net


def export_browser_weights(model, output_path):
    """
    Serializes linear layer weights & biases to a compact JSON file
    that can be executed inside the browser without Python or heavyweight frameworks!
    """
    weights = {}
    for name, param in model.named_parameters():
        weights[name] = param.detach().cpu().numpy().tolist()

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(weights, f)
    print(f"Exported browser neural weights to {output_path} ({os.path.getsize(output_path)} bytes)")


if __name__ == '__main__':
    train()
