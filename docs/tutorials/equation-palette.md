# Equation Palette

The equation palette is a visual symbol picker built into the LaTeX editor. It lets you insert math symbols, Greek letters, and equation structures by clicking, without needing to memorize LaTeX commands.

## Opening the equation palette

1. Add a **LaTeX** element to your slide (from the Text dropdown in the toolbar).
2. Double-click the LaTeX element to open the editor.
3. The equation palette appears as a tabbed bar at the bottom of the editor's left panel, below the text area.

## Using the palette

1. Place your cursor in the LaTeX text area where you want to insert a symbol.
2. Click a **category tab** (Greek, Operators, Relations, etc.).
3. Click a **symbol button** to insert its LaTeX command at the cursor position.
4. The preview panel on the right updates immediately.

Hover over any button to see its LaTeX command in a tooltip.

## Categories

| Category | Contents | Examples |
|---|---|---|
| **Greek** | Lowercase and uppercase Greek letters | α β γ δ Σ Ω |
| **Operators** | Arithmetic, calculus, and set operators | × ÷ ± ∇ ∂ ∞ |
| **Relations** | Equality, inequality, and set relations | ≠ ≤ ≥ ≈ ∝ ∈ ⊂ |
| **Arrows** | Directional arrows | → ← ⇒ ⇔ ↦ |
| **Functions** | Standard math functions | sin cos tan log lim |
| **Accents** | Decorations on variables | x̂ x̄ x⃗ ẋ x̃ |
| **Structures** | Fractions, roots, matrices, integrals | frac, sqrt, sum, int, matrix, cases |
| **Misc** | Physics, logic, and other symbols | ℏ ℓ ⟨⟩ ∀ ∃ ∅ |

## Structure templates

The **Structures** category contains templates that insert multi-part LaTeX constructs:

- **Fraction**: `\frac{a}{b}` — replace `a` and `b` with your content
- **Square root**: `\sqrt{x}`
- **Nth root**: `\sqrt[n]{x}`
- **Sum**: `\sum_{i=1}^{n}` — with lower and upper bounds
- **Integral**: `\int_{a}^{b}`
- **Matrix**: `\begin{pmatrix} a & b \\ c & d \end{pmatrix}` — 2x2 matrix template
- **Cases**: `\begin{cases} a & \text{if } x > 0 \\ b & \text{otherwise} \end{cases}`

After inserting a structure, edit the placeholder values directly in the text area.

::: tip
You can combine palette clicks with manual typing. For example, click the fraction button to insert `\frac{a}{b}`, then select `a` and type your numerator. The palette inserts at the cursor position, so you can build complex expressions incrementally.
:::

## Using with inline math

The equation palette is also useful when editing inline math nodes in text elements. While the palette is only available in the full LaTeX editor modal, you can:

1. Create a LaTeX element with your equation.
2. Copy the LaTeX source.
3. Paste it into an inline math node using the Properties Panel math editor.
