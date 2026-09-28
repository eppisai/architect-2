"""Render the proposed Architect 2.0 production architecture as a PNG."""
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyArrowPatch, FancyBboxPatch

ROOT = Path(__file__).resolve().parent
BG = "#F5F8F6"
INK = "#202725"
MUTED = "#586861"
GREEN = "#3F725D"
PALE = "#EAF3ED"
LINE = "#D3E1D8"
ORANGE = "#C27745"

fig, ax = plt.subplots(figsize=(18.5, 10), dpi=170)
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.set_xlim(0, 1850)
ax.set_ylim(0, 1000)
ax.axis("off")


def card(x, y, w, h, number, eyebrow, title, body, tint=False):
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h, boxstyle="round,pad=0.02,rounding_size=23",
        linewidth=1.8, edgecolor=LINE if not tint else "#AFCFBA",
        facecolor="#FFFFFF" if not tint else PALE))
    ax.add_patch(Circle((x + 36, y + h - 38), 18, facecolor=GREEN, edgecolor="none"))
    ax.text(x + 36, y + h - 38, number, ha="center", va="center",
            color="white", fontsize=11, fontweight="bold")
    ax.text(x + 65, y + h - 38, eyebrow.upper(), va="center",
            fontsize=10.8, fontweight="bold", color=GREEN)
    ax.text(x + 25, y + h - 83, title, va="top",
            fontsize=17.2, fontweight="bold", color=INK, linespacing=1.2)
    ax.text(x + 25, y + h - 151, body, va="top",
            fontsize=12.1, color=MUTED, linespacing=1.45)


def support(x, y, w, h, title, body):
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h, boxstyle="round,pad=0.02,rounding_size=19",
        linewidth=1.4, edgecolor=LINE, facecolor="#FFFFFF"))
    ax.text(x + 24, y + h - 35, title, va="top", fontsize=15.2,
            fontweight="bold", color=INK)
    ax.text(x + 24, y + h - 75, body, va="top", fontsize=11.8,
            color=MUTED, linespacing=1.35)


def arrow(x1, y1, x2, y2, label=None, color=GREEN, lw=2.6):
    ax.add_patch(FancyArrowPatch(
        (x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=19,
        linewidth=lw, color=color, shrinkA=0, shrinkB=0))
    if label:
        ax.text((x1 + x2)/2, y1 + 12, label, ha="center", va="bottom",
                fontsize=10.5, color=color, fontweight="medium")


ax.text(55, 925, "Architect 2.0", fontsize=32, fontweight="bold", color=INK)
ax.text(55, 883, "From an idea or a repository to a reviewable agentic application",
        fontsize=16, color=MUTED)
ax.text(1790, 931, "PROPOSED PRODUCTION SYSTEM", ha="right",
        fontsize=11, fontweight="bold", color=GREEN)
ax.plot([55, 1795], [854, 854], color=LINE, linewidth=1.5)

# The five central decisions form one legible left-to-right story.
y, h = 465, 266
card(55, y, 280, h, "01", "Start", "Idea or\nrepository", "Prompt, template, or pinned\nGitHub commit")
card(405, y, 280, h, "02", "Experience", "One project\nworkspace", "Chat · Preview · Agents\nCode · Data", tint=True)
card(755, y, 280, h, "03", "Control", "Plan and\ncoordinate", "OIDC + roles · project versions\nDurable jobs + preview proxy")
card(1105, y, 330, h, "04", "Execution", "Build in an\nisolated sandbox", "gVisor + quotas · agent harness\nFramework adapters · run · test")
card(1505, y, 290, h, "05", "Ship", "Review and\npublish", "Tested artifact · deploy controller\nRelease history + rollback", tint=True)

for a, b, label in [(335, 405, "intent"), (685, 755, "versioned job"),
                    (1035, 1105, "scoped run"), (1435, 1505, "tested build")]:
    arrow(a, 598, b - 6, 598, label)

# The return path makes the preview relationship explicit without crossing cards.
ax.plot([1270, 1270, 545], [733, 793, 793], color=ORANGE, linewidth=2.3)
arrow(545, 793, 545, 736, color=ORANGE, lw=2.3)
ax.text(905, 803, "Live preview returns through the authenticated proxy",
        ha="center", fontsize=11.8, color=ORANGE, fontweight="medium")

ax.text(55, 416, "FOUNDATION & EXTERNAL CONNECTIONS", fontsize=11.5,
        fontweight="bold", color=GREEN)
ax.plot([55, 1795], [398, 398], color=LINE, linewidth=1.2)

support(55, 186, 280, 174, "GitHub App", "Repo-scoped import\nBranch, checks, pull request")
support(755, 186, 280, 174, "Durable state", "PostgreSQL · object storage\nJob queue · secrets manager")
support(1105, 186, 330, 174, "Model + tool gateway", "Provider adapters + budgets\nPermissioned tools · scoped egress")
support(1505, 186, 290, 174, "Deployed app", "HTTPS + custom domain\nIndependent runtime scaling")

# Short vertical connectors show ownership; detailed protocols live in the MD.
for cx in (195, 895, 1270, 1650):
    ax.plot([cx, cx], [361, 456], color=GREEN, linewidth=1.6, alpha=.68,
            linestyle=(0, (3, 4)))

ax.add_patch(FancyBboxPatch((55, 65), 1740, 70,
                            boxstyle="round,pad=0.02,rounding_size=16",
                            linewidth=0, facecolor="#E6EFE9"))
ax.text(77, 100, "SCALE & SAFETY", va="center", fontsize=11.8,
        fontweight="bold", color=GREEN)
ax.text(250, 100,
        "Stateless control plane  ·  queued, quota-limited sandboxes  ·  separate app runtime  ·  signed preview routes  ·  no secrets in source",
        va="center", fontsize=12.3, color=INK)
ax.text(55, 26, "Live submission: static browser prototype with local storage. The services above are the production design, not running integrations.",
        fontsize=10.8, color=MUTED)

fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
fig.savefig(ROOT / "architecture-diagram.png", dpi=170,
            facecolor=BG, bbox_inches="tight", pad_inches=0)
plt.close(fig)
