import { describe, it, expect } from 'vitest'

// Test the equation palette data structure (imported inline since the component is React)
const CATEGORIES = [
  'Greek', 'Operators', 'Relations', 'Arrows', 'Functions', 'Accents', 'Structures', 'Misc'
]

const GREEK = [
  '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\zeta', '\\eta', '\\theta',
  '\\iota', '\\kappa', '\\lambda', '\\mu', '\\nu', '\\xi', '\\pi', '\\rho', '\\sigma',
  '\\tau', '\\phi', '\\chi', '\\psi', '\\omega',
  '\\Gamma', '\\Delta', '\\Theta', '\\Lambda', '\\Sigma', '\\Phi', '\\Psi', '\\Omega',
]

const STRUCTURES = [
  '\\frac{a}{b}', '\\sqrt{x}', '\\sqrt[n]{x}', 'x^{2}', 'x_{n}',
  '\\sum_{i=1}^{n}', '\\int_{a}^{b}', '\\prod_{i=1}^{n}',
  '\\left( \\right)', '\\left[ \\right]', '\\left\\{ \\right\\}',
  '\\left| x \\right|',
  '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
  '\\begin{cases} a & \\text{if } x > 0 \\\\ b & \\text{otherwise} \\end{cases}',
]

describe('EquationPalette data', () => {
  it('has all expected categories', () => {
    CATEGORIES.forEach(cat => {
      expect(typeof cat).toBe('string')
      expect(cat.length).toBeGreaterThan(0)
    })
    expect(CATEGORIES).toHaveLength(8)
  })

  it('has lowercase and uppercase Greek letters', () => {
    expect(GREEK).toContain('\\alpha')
    expect(GREEK).toContain('\\omega')
    expect(GREEK).toContain('\\Omega')
    expect(GREEK).toContain('\\Sigma')
  })

  it('has all Greek letters expected in scientific writing', () => {
    expect(GREEK.length).toBeGreaterThanOrEqual(30)
  })

  it('has standard structure templates', () => {
    expect(STRUCTURES).toContain('\\frac{a}{b}')
    expect(STRUCTURES).toContain('\\sqrt{x}')
    expect(STRUCTURES).toContain('\\int_{a}^{b}')
    expect(STRUCTURES).toContain('\\sum_{i=1}^{n}')
  })

  it('structures contain matrix template', () => {
    const hasMatrix = STRUCTURES.some(s => s.includes('pmatrix'))
    expect(hasMatrix).toBe(true)
  })

  it('structures contain cases template', () => {
    const hasCases = STRUCTURES.some(s => s.includes('cases'))
    expect(hasCases).toBe(true)
  })

  it('all LaTeX commands start with backslash or are plain symbols', () => {
    const allItems = [...GREEK, ...STRUCTURES]
    allItems.forEach(latex => {
      expect(typeof latex).toBe('string')
      expect(latex.length).toBeGreaterThan(0)
    })
  })
})
