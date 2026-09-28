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


# Strategic mazing coordinates: staggered serpentine and central killzone coils
STRATEGIC_MAZE_TEMPLATE = []
# 1. Central killzone rings around (16, 16)
for r in [14, 15, 17, 18]:
    for c in [14, 15, 17, 18]:
        STRATEGIC_MAZE_TEMPLATE.append((c, r))

# 2. Concentric rings forcing serpentine detours
for offset in [4, 6, 8, 10, 12]:
    for x in range(16 - offset, 16 + offset + 1, 2):
        STRATEGIC_MAZE_TEMPLATE.append((x, 16 - offset))
        STRATEGIC_MAZE_TEMPLATE.append((x, 16 + offset))
    for y in range(16 - offset, 16 + offset + 1, 2):
        STRATEGIC_MAZE_TEMPLATE.append((16 - offset, y))
        STRATEGIC_MAZE_TEMPLATE.append((16 + offset, y))


def select_best_maze_placements(env, count=5):
    """
    Ultra-fast strategic mazing coordinator.
    Selects valid placement tiles from strategic serpentine template,
    ensuring continuous path connectivity while extending creep route.
    """
    chosen = []
    # Test template slots first
    for x, y in STRATEGIC_MAZE_TEMPLATE:
        if env.can_place_at(x, y):
            chosen.append((x, y))
            env.grid[y, x] = 1
            if len(chosen) >= count:
                break

    # If more needed, pick from safe grid slots
    if len(chosen) < count:
        for x in range(6, 27, 3):
            for y in range(6, 27, 3):
                if env.can_place_at(x, y):
                    chosen.append((x, y))
                    env.grid[y, x] = 1
                    if len(chosen) >= count:
                        break
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
    print("GEM TD - REINFORCEMENT LEARNING TRAINING")
    print(f"Episodes: {NUM_EPISODES} | Batch: {BATCH_SIZE} | LR: {LR}")
    print("=" * 60)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")

    policy_net = GemDecisionNetwork(input_dim=96, hidden_dim=128, num_actions=7).to(device)
    target_net = GemDecisionNetwork(input_dim=96, hidden_dim=128, num_actions=7).to(device)
    target_net.load_state_dict(policy_net.state_dict())
    target_net.eval()

    optimizer = optim.AdamW(policy_net.parameters(), lr=LR, weight_decay=1e-4)
    criterion = nn.SmoothL1Loss()
    memory = ReplayBuffer(MEMORY_SIZE)

    epsilon = EPS_START
    best_wave = 0
    total_victories = 0
    start_time = time.time()

    recent_waves = deque(maxlen=50)
    recent_rewards = deque(maxlen=50)
    recent_path_lens = deque(maxlen=50)

    for episode in range(1, NUM_EPISODES + 1):
        env = GemTDEnv()
        state_tensor = extract_state_features(env).to(device)
        ep_reward = 0.0
        recipes_crafted = 0

        while not env.game_over and not env.victory and env.wave <= 50:
            initial_path_len = env.path_length

            # 1. Mazing Phase: Select 5 candidate coordinates
            coords = select_best_maze_placements(env, count=5)
            if len(coords) < 5:
                break

            # Start round & place 5 gems
            env.start_round()
            env.place_5_gems(coords)

            # Path length gain reward
            path_gain = env.path_length - initial_path_len
            ep_reward += path_gain * 0.2

            # 2. Gem Selection / Action Phase
            action_mask = get_action_mask(env)
            action, prob, value = policy_net.get_action(state_tensor, action_mask=action_mask, epsilon=epsilon)

            # Execute action
            reward = 0.0
            if action in [0, 1, 2, 3, 4]:
                # Keep gem
                tower = env.keep_gem(action)
                # Small reward for higher quality gems
                reward += tower['level'] * 2.0
            elif action == 5:
                # Craft Special Recipe
                avail_recipes = env.find_available_recipes()
                if avail_recipes:
                    rec_name = avail_recipes[0]
                    env.craft_special_tower(rec_name, chosen_coord_idx=0)
                    recipes_crafted += 1
                    reward += 25.0  # Big bonus for special tower!
                else:
                    env.keep_gem(0)
            elif action == 6:
                # Duplicate Combine
                dup_upgrades = env.find_duplicate_upgrades()
                if dup_upgrades:
                    env.keep_gem(0)
                    reward += 15.0  # Upgrade combination bonus
                else:
                    env.keep_gem(0)

            # 3. Wave Combat Simulation
            creeps_killed, dmg_dealt, lives_lost, gold_earned = env.simulate_wave_combat()

            # Wave rewards
            reward += (creeps_killed * 2.0)
            reward -= (lives_lost * 3.0)

            if env.victory:
                reward += 150.0
                total_victories += 1
            elif env.game_over:
                reward -= 40.0
            else:
                reward += 8.0  # Wave cleared bonus

            # Auto chance upgrade
            if env.check_upgrade_chance():
                reward += 5.0

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

        # Decay exploration epsilon
        epsilon = max(EPS_END, epsilon * EPS_DECAY)

        if episode % TARGET_UPDATE == 0:
            target_net.load_state_dict(policy_net.state_dict())

        # Logging
        if episode % 20 == 0 or episode == NUM_EPISODES:
            avg_wave = np.mean(recent_waves)
            avg_rew = np.mean(recent_rewards)
            avg_path = np.mean(recent_path_lens)
            elapsed = time.time() - start_time
            print(f"[{episode:4d}/{NUM_EPISODES}] Avg Wave: {avg_wave:.1f} | Best Wave: {best_wave:2d} | Avg Path: {avg_path:.1f} | Avg Rew: {avg_rew:6.1f} | Eps: {epsilon:.3f} | {elapsed:.1f}s", flush=True)

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
