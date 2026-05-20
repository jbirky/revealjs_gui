// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState } from 'react'

const CATEGORIES = [
  {
    name: 'Greek',
    items: [
      { label: 'α', latex: '\\alpha' }, { label: 'β', latex: '\\beta' }, { label: 'γ', latex: '\\gamma' },
      { label: 'δ', latex: '\\delta' }, { label: 'ε', latex: '\\epsilon' }, { label: 'ζ', latex: '\\zeta' },
      { label: 'η', latex: '\\eta' }, { label: 'θ', latex: '\\theta' }, { label: 'ι', latex: '\\iota' },
      { label: 'κ', latex: '\\kappa' }, { label: 'λ', latex: '\\lambda' }, { label: 'μ', latex: '\\mu' },
      { label: 'ν', latex: '\\nu' }, { label: 'ξ', latex: '\\xi' }, { label: 'π', latex: '\\pi' },
      { label: 'ρ', latex: '\\rho' }, { label: 'σ', latex: '\\sigma' }, { label: 'τ', latex: '\\tau' },
      { label: 'φ', latex: '\\phi' }, { label: 'χ', latex: '\\chi' }, { label: 'ψ', latex: '\\psi' },
      { label: 'ω', latex: '\\omega' },
      { label: 'Γ', latex: '\\Gamma' }, { label: 'Δ', latex: '\\Delta' }, { label: 'Θ', latex: '\\Theta' },
      { label: 'Λ', latex: '\\Lambda' }, { label: 'Σ', latex: '\\Sigma' }, { label: 'Φ', latex: '\\Phi' },
      { label: 'Ψ', latex: '\\Psi' }, { label: 'Ω', latex: '\\Omega' },
    ],
  },
  {
    name: 'Operators',
    items: [
      { label: '+', latex: '+' }, { label: '−', latex: '-' }, { label: '×', latex: '\\times' },
      { label: '÷', latex: '\\div' }, { label: '±', latex: '\\pm' }, { label: '∓', latex: '\\mp' },
      { label: '·', latex: '\\cdot' }, { label: '∘', latex: '\\circ' }, { label: '⊗', latex: '\\otimes' },
      { label: '⊕', latex: '\\oplus' }, { label: '†', latex: '\\dagger' }, { label: '∇', latex: '\\nabla' },
      { label: '∂', latex: '\\partial' }, { label: '∞', latex: '\\infty' },
    ],
  },
  {
    name: 'Relations',
    items: [
      { label: '=', latex: '=' }, { label: '≠', latex: '\\neq' }, { label: '<', latex: '<' },
      { label: '>', latex: '>' }, { label: '≤', latex: '\\leq' }, { label: '≥', latex: '\\geq' },
      { label: '≈', latex: '\\approx' }, { label: '∝', latex: '\\propto' }, { label: '≡', latex: '\\equiv' },
      { label: '∼', latex: '\\sim' }, { label: '≪', latex: '\\ll' }, { label: '≫', latex: '\\gg' },
      { label: '∈', latex: '\\in' }, { label: '∉', latex: '\\notin' }, { label: '⊂', latex: '\\subset' },
      { label: '⊆', latex: '\\subseteq' }, { label: '∪', latex: '\\cup' }, { label: '∩', latex: '\\cap' },
    ],
  },
  {
    name: 'Arrows',
    items: [
      { label: '→', latex: '\\rightarrow' }, { label: '←', latex: '\\leftarrow' },
      { label: '↔', latex: '\\leftrightarrow' }, { label: '⇒', latex: '\\Rightarrow' },
      { label: '⇐', latex: '\\Leftarrow' }, { label: '⇔', latex: '\\Leftrightarrow' },
      { label: '↦', latex: '\\mapsto' }, { label: '↑', latex: '\\uparrow' },
      { label: '↓', latex: '\\downarrow' },
    ],
  },
  {
    name: 'Functions',
    items: [
      { label: 'sin', latex: '\\sin' }, { label: 'cos', latex: '\\cos' }, { label: 'tan', latex: '\\tan' },
      { label: 'log', latex: '\\log' }, { label: 'ln', latex: '\\ln' }, { label: 'exp', latex: '\\exp' },
      { label: 'lim', latex: '\\lim_{x \\to }' }, { label: 'max', latex: '\\max' },
      { label: 'min', latex: '\\min' }, { label: 'det', latex: '\\det' }, { label: 'deg', latex: '\\deg' },
      { label: 'arg', latex: '\\arg' },
    ],
  },
  {
    name: 'Accents',
    items: [
      { label: 'x̂', latex: '\\hat{x}' }, { label: 'x̄', latex: '\\bar{x}' },
      { label: 'x⃗', latex: '\\vec{x}' }, { label: 'ẋ', latex: '\\dot{x}' },
      { label: 'x̃', latex: '\\tilde{x}' }, { label: 'ẍ', latex: '\\ddot{x}' },
      { label: 'x˘', latex: '\\breve{x}' },
    ],
  },
  {
    name: 'Structures',
    items: [
      { label: '¹⁄ₓ', latex: '\\frac{a}{b}', desc: 'Fraction' },
      { label: '√', latex: '\\sqrt{x}', desc: 'Square root' },
      { label: 'ⁿ√', latex: '\\sqrt[n]{x}', desc: 'Nth root' },
      { label: 'x²', latex: 'x^{2}', desc: 'Superscript' },
      { label: 'xₙ', latex: 'x_{n}', desc: 'Subscript' },
      { label: 'Σ', latex: '\\sum_{i=1}^{n}', desc: 'Sum' },
      { label: '∫', latex: '\\int_{a}^{b}', desc: 'Integral' },
      { label: '∏', latex: '\\prod_{i=1}^{n}', desc: 'Product' },
      { label: '( )', latex: '\\left( \\right)', desc: 'Parentheses' },
      { label: '[ ]', latex: '\\left[ \\right]', desc: 'Brackets' },
      { label: '{ }', latex: '\\left\\{ \\right\\}', desc: 'Braces' },
      { label: '|x|', latex: '\\left| x \\right|', desc: 'Absolute value' },
      { label: '2×2', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', desc: 'Matrix' },
      { label: 'cases', latex: '\\begin{cases} a & \\text{if } x > 0 \\\\ b & \\text{otherwise} \\end{cases}', desc: 'Cases' },
      { label: '...', latex: '\\cdots', desc: 'Dots (center)' },
      { label: '⋮', latex: '\\vdots', desc: 'Dots (vertical)' },
      { label: 'text', latex: '\\text{}', desc: 'Text in math' },
    ],
  },
  {
    name: 'Misc',
    items: [
      { label: 'ℏ', latex: '\\hbar' }, { label: 'ℓ', latex: '\\ell' },
      { label: '⟨⟩', latex: '\\langle \\rangle' }, { label: '∀', latex: '\\forall' },
      { label: '∃', latex: '\\exists' }, { label: '⊥', latex: '\\perp' },
      { label: '∥', latex: '\\parallel' }, { label: '∅', latex: '\\emptyset' },
      { label: '★', latex: '\\star' }, { label: '◻', latex: '\\Box' },
    ],
  },
]

export default function EquationPalette({ onInsert }) {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].name)
  const category = CATEGORIES.find(c => c.name === activeCategory) || CATEGORIES[0]

  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-panel)', flexShrink: 0 }}>
      {/* Category tabs */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', padding: '0 4px' }}>
        {CATEGORIES.map(cat => (
          <button key={cat.name} onClick={() => setActiveCategory(cat.name)}
            style={{
              padding: '5px 10px', fontSize: 11, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              background: activeCategory === cat.name ? 'var(--bg-hover)' : 'transparent',
              color: activeCategory === cat.name ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: activeCategory === cat.name ? '2px solid var(--accent)' : '2px solid transparent',
              fontWeight: activeCategory === cat.name ? 600 : 400,
            }}>
            {cat.name}
          </button>
        ))}
      </div>
      {/* Symbol grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: '6px 8px', maxHeight: 100, overflowY: 'auto' }}>
        {category.items.map((item, i) => (
          <button key={i} onClick={() => onInsert(item.latex)}
            title={item.desc ? `${item.desc}: ${item.latex}` : item.latex}
            style={{
              minWidth: 32, height: 28, padding: '2px 6px', fontSize: item.latex.length > 10 ? 10 : 14,
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4,
              color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: item.name === 'Functions' ? 'serif' : 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'white' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-primary)' }}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
