"""
PyTorch Neural Network Models for Gem TD RL Agent.
Includes Gem Evaluator Network, Actor-Critic, and Maze Value Estimator.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np

class GemDecisionNetwork(nn.Module):
    """
    Evaluates game state + 5 rolled gems to decide whether to:
    - Keep gem 0..4
    - Craft special recipe
    - Combine duplicate
    """
    def __init__(self, input_dim=104, hidden_dim=128, num_actions=9):
        super().__init__()
        self.input_dim = input_dim
        self.num_actions = num_actions

        # Shared feature extractor
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.ln1 = nn.LayerNorm(hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, hidden_dim)
        self.ln2 = nn.LayerNorm(hidden_dim)

        # Policy head (Action Logits)
        self.policy_head = nn.Sequential(
            nn.Linear(hidden_dim, 64),
            nn.ReLU(),
            nn.Linear(64, num_actions)
        )

        # Value head (State Value V(s))
        self.value_head = nn.Sequential(
            nn.Linear(hidden_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 1)
        )

    def forward(self, x):
        h = F.relu(self.ln1(self.fc1(x)))
        h = F.relu(self.ln2(self.fc2(h)))
        logits = self.policy_head(h)
        value = self.value_head(h)
        return logits, value

    def get_action(self, state_tensor, action_mask=None, epsilon=0.0):
        """Select action with epsilon-greedy or softmax policy."""
        logits, value = self.forward(state_tensor)
        
        if action_mask is not None:
            # Mask out invalid actions by setting logits to very large negative number
            mask_tensor = torch.tensor(action_mask, dtype=torch.bool, device=logits.device)
            logits = logits.masked_fill(~mask_tensor, -1e9)

        if np.random.rand() < epsilon:
            # Random exploration among valid actions
            valid_actions = [i for i, m in enumerate(action_mask) if m] if action_mask is not None else list(range(self.num_actions))
            action = np.random.choice(valid_actions)
            prob = 1.0 / len(valid_actions)
        else:
            probs = F.softmax(logits, dim=-1)
            action = torch.argmax(probs, dim=-1).item()
            prob = probs[0, action].item()

        return action, prob, value.item()


class MazeEvaluator(nn.Module):
    """
    Scores potential tile placements to find the optimal maze coordinates.
    """
    def __init__(self, input_dim=8):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1)
        )

    def forward(self, features):
        return self.net(features)
