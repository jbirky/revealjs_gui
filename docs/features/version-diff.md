# Version Diff

Compare any two versions of your presentation to see exactly what changed — which slides were added or removed, which elements moved, resized, or had content updated.

## Accessing the diff viewer

There are two ways to compare versions:

### From snapshots

1. Open your presentation in the editor.
2. Click the **History** button (clock icon) in the top toolbar.
3. Next to each saved snapshot, click **Compare**.
4. The diff viewer opens, comparing that snapshot against your current presentation state.

### From git history

1. Click **Sync → Git History** in the editor toolbar.
2. Next to each commit, click **Compare**.
3. The diff viewer opens, comparing the presentation at that commit against your current version.

::: tip
Save a snapshot before making large changes so you always have a comparison point. Snapshots are free and instant.
:::

## Reading the diff viewer

The diff viewer is a split-pane modal:

### Slide list (left panel)

Each slide in your presentation appears with a color-coded status dot:

| Color | Meaning |
|-------|---------|
| Green | Slide was added (new in current version) |
| Red | Slide was removed (existed in old version only) |
| Amber | Slide was modified (elements or properties changed) |
| Gray | Slide is unchanged |

The header shows a summary: total added, removed, and modified slides.

Click any slide in the list to see its details in the right panel.

### Detail panel (right)

For **modified slides**, the panel shows two sections:

**Slide properties** — changes to the slide itself (background color, speaker notes, transition, section label).

**Element changes** — a list of every element that was added, removed, or modified. Each entry shows:

- An icon indicating the type of change (move, resize, content edit, style change)
- The element type (text, image, shape, etc.)
- A status badge

Click any element change row to expand it and see the specific property diffs, for example:

```
x: 100 → 250
y: 80 → 80
width: 400 → 600
content changed (45 → 120 chars)
```

## Change categories

The diff classifies element changes into these categories:

| Status | Meaning | Example |
|--------|---------|---------|
| **added** | Element exists in current but not in old version | Added a new image |
| **removed** | Element existed in old version but was deleted | Removed a text box |
| **moved** | Position (x, y) changed | Dragged an element to a new spot |
| **resized** | Dimensions (width, height) changed | Stretched an image wider |
| **content-changed** | The element's content was edited | Changed text, swapped image src |
| **style-changed** | Visual properties changed | Opacity, fill color, border radius |

If an element was both moved and resized, it shows as "moved" (the most significant spatial change). Content changes take priority over style changes.

## How matching works

The diff matches slides and elements by their internal IDs, not by position or content. This means:

- **Reordering slides** does not count as a change — the diff recognizes that slide 3 moved to position 1.
- **Reordering elements** (bring to front / send to back) changes `zIndex`, which shows as a style change.
- **Duplicating a slide** creates a new slide with new IDs, so it appears as "added" (not "modified copy of").

::: tip
Small floating-point differences in position (less than 0.5px) are ignored to avoid noise from rounding during drag operations.
:::

## Tips

- **Quick check after large edits**: save a snapshot, make your changes, then compare to review everything before presenting.
- **Review a teammate's changes**: if someone pushes to your shared GitHub repo, pull the git history and compare their commit against your local version.
- **Find regressions**: if a presentation looks different after restoring from a backup, compare to see which elements shifted.
