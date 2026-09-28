"""Render the submission's proposed production architecture diagram.

Requires matplotlib. The generated PNG is the upload-friendly artifact; the SVG is
an editable vector copy. This is a design proposal, not the live demo topology.
"""

from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch


ROOT = Path(__file__).resolve().parent
INK = "#202725"
MUTED = "#61706A"
GREEN = "#4C7868"
LINE = "#DCE5E0"
BG = "#F7F9F8"

fig, ax = plt.subplots(figsize=(16, 9), dpi=180)
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.set_xlim(0, 1600)
ax.set_ylim(0, 900)
ax.axis("off")


def box(x, y, w, h, heading, detail, fill="#FFFFFF", edge=LINE):
    ax.add_patch(
        FancyBboxPatch(
            (x, y), w, h,
            boxstyle="round,pad=0.018,rounding_size=17",
            linewidth=1.4, edgecolor=edge, facecolor=fill,
        )
    )
    ax.text(x + 22, y + h - 35, heading, ha="left", va="top",
            fontsize=14.4, fontweight="bold", color=INK)
    ax.text(x + 22, y + h - 69, detail, ha="left", va="top",
            fontsize=10.9, color=MUTED, linespacing=1.5)


def arrow(x1, y1, x2, y2, label=None, color=GREEN):
    ax.add_patch(FancyArrowPatch(
        (x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=16,
        linewidth=2.2, color=color, shrinkA=0, shrinkB=0,
        connectionstyle="arc3,rad=0",
    ))
    if label:
        ax.text((x1 + x2) / 2, y1 + 11, label, ha="center", va="bottom",
                fontsize=9.3, color=GREEN, fontweight="medium")


ax.text(72, 834, "Architect 2.0", fontsize=29, fontweight="bold", color=INK)
ax.text(72, 794, "Proposed production architecture  /  one workspace, isolated execution",
        fontsize=15, color=MUTED)
ax.text(1532, 837, "SUBMISSION DESIGN", ha="right", fontsize=10.5,
        fontweight="bold", color=GREEN)
ax.plot([72, 1532], [769, 769], color=LINE, linewidth=1.4)

for x, title in [(72, "EXPERIENCE"), (423, "CONTROL PLANE"),
                 (800, "EXECUTION & INTEGRATIONS"), (1190, "DESTINATIONS")]:
    ax.text(x, 733, title, fontsize=11, fontweight="bold", color=GREEN)

rows = [553, 346, 139]
height = 151

box(72, rows[0], 275, height, "Build & preview",
    "Prompt, plan, chat, selection\nPreview beside the agent")
box(423, rows[0], 300, height, "API + preview proxy",
    "OIDC, project roles, signed routes\nSSE / WebSocket progress")
box(800, rows[0], 310, height, "Agent sandbox",
    "gVisor sandbox, harness, adapters\nModel gateway + scoped tools", fill="#EFF6F2", edge="#B9D0C2")
box(1190, rows[0], 342, height, "Models & connections",
    "Provider adapters, MCP / API / A2A\nCredentials via policy egress")

box(72, rows[1], 275, height, "Inspect & review",
    "Code, data, diffs, tests\nVersions and repair approval")
box(423, rows[1], 300, height, "Project API + job queue",
    "Versioned specification, traces\nDurable plan / build / test jobs")
box(800, rows[1], 310, height, "GitHub App + sync",
    "Pinned import, isolated branch\nChecks, PR, webhook reconcile", fill="#EFF6F2", edge="#B9D0C2")
box(1190, rows[1], 342, height, "GitHub repository",
    "Repository-owned source of truth\nLeast-privilege installation")

box(72, rows[2], 275, height, "Publish & recover",
    "Preflight, access, domain\nRelease history and rollback")
box(423, rows[2], 300, height, "Release controller",
    "Approve immutable artifact\nPromote, observe, roll back")
box(800, rows[2], 310, height, "Build & runtime",
    "Sandboxed build and tests\nCDN + managed containers", fill="#EFF6F2", edge="#B9D0C2")
box(1190, rows[2], 342, height, "Deployed application",
    "HTTPS, health checks, analytics\nSeparate preview / production")

for y, labels in [(rows[0] + height/2, ["intent", "scoped job", "policy calls"]),
                  (rows[1] + height/2, ["review", "source ops", "branch / PR"]),
                  (rows[2] + height/2, ["approve", "artifact", "release"])]:
    arrow(347, y, 417, y, labels[0])
    arrow(723, y, 794, y, labels[1])
    arrow(1110, y, 1184, y, labels[2])

ax.add_patch(FancyBboxPatch((423, 26), 1109, 76,
                            boxstyle="round,pad=0.018,rounding_size=15",
                            linewidth=1.2, edgecolor=LINE, facecolor="#EAF0ED"))
ax.text(446, 75, "SHARED STATE & GUARDRAILS",
        fontsize=10.8, fontweight="bold", color=GREEN, va="center")
ax.text(446, 47,
        "PostgreSQL metadata  ·  durable queue  ·  object-storage snapshots  ·  secrets manager  ·  logs, traces and budgets",
        fontsize=11.4, color=INK, va="center")
ax.text(72, 51, "Live demo: static UI\n+ browser storage",
        fontsize=10.3, color=MUTED, va="center", linespacing=1.35)

fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
for extension in ("png", "svg"):
    fig.savefig(ROOT / f"architecture-diagram.{extension}",
                dpi=180, facecolor=BG, bbox_inches="tight", pad_inches=0)
plt.close(fig)
