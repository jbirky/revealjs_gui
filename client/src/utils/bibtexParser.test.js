import { describe, it, expect } from 'vitest'
import {
  parseBibtex,
  parseAuthors,
  formatAuthorsShort,
  formatAuthorsFull,
  formatCitation,
  formatReference,
} from './bibtexParser'

describe('parseBibtex', () => {
  it('parses a single article entry', () => {
    const bib = `@article{smith2020,
      author = {Smith, John and Doe, Jane},
      title = {A Great Paper},
      journal = {Nature},
      year = {2020},
      volume = {42},
      pages = {100--110},
    }`
    const entries = parseBibtex(bib)
    expect(entries).toHaveLength(1)
    expect(entries[0].key).toBe('smith2020')
    expect(entries[0].type).toBe('article')
    expect(entries[0].title).toBe('A Great Paper')
    expect(entries[0].author).toBe('Smith, John and Doe, Jane')
    expect(entries[0].journal).toBe('Nature')
    expect(entries[0].year).toBe('2020')
    expect(entries[0].volume).toBe('42')
    expect(entries[0].pages).toBe('100--110')
  })

  it('parses multiple entries', () => {
    const bib = `
@article{one, author={A}, title={First}, year={2020}}
@inproceedings{two, author={B}, title={Second}, year={2021}}
@book{three, author={C}, title={Third}, year={2022}}
    `
    const entries = parseBibtex(bib)
    expect(entries).toHaveLength(3)
    expect(entries.map(e => e.key)).toEqual(['one', 'two', 'three'])
    expect(entries.map(e => e.type)).toEqual(['article', 'inproceedings', 'book'])
  })

  it('handles quote-delimited values', () => {
    const bib = `@article{key, author="Smith, John", title="A Title"}`
    const entries = parseBibtex(bib)
    expect(entries[0].author).toBe('Smith, John')
    expect(entries[0].title).toBe('A Title')
  })

  it('handles nested braces in values', () => {
    const bib = `@article{key, title={The {JWST} Observatory}}`
    const entries = parseBibtex(bib)
    expect(entries[0].title).toBe('The JWST Observatory')
  })

  it('cleans common LaTeX commands', () => {
    const bib = `@article{key, title={Stars \\& Galaxies}, author={M\\\"uller, Hans}}`
    const entries = parseBibtex(bib)
    expect(entries[0].title).toBe('Stars & Galaxies')
  })

  it('skips @string, @preamble, @comment entries', () => {
    const bib = `
@string{jnl = {Astrophysical Journal}}
@preamble{"some preamble"}
@comment{this is a comment}
@article{real, title={Real Entry}, year={2020}}
    `
    const entries = parseBibtex(bib)
    expect(entries).toHaveLength(1)
    expect(entries[0].key).toBe('real')
  })

  it('returns empty array for empty input', () => {
    expect(parseBibtex('')).toEqual([])
  })

  it('returns empty array for garbage input', () => {
    expect(parseBibtex('not bibtex at all')).toEqual([])
  })

  it('handles entries with DOI field', () => {
    const bib = `@article{key, doi={10.1234/example}}`
    const entries = parseBibtex(bib)
    expect(entries[0].doi).toBe('10.1234/example')
  })

  it('is case-insensitive for entry types', () => {
    const bib = `@Article{key1, title={One}}
@INPROCEEDINGS{key2, title={Two}}`
    const entries = parseBibtex(bib)
    expect(entries).toHaveLength(2)
    expect(entries[0].type).toBe('article')
    expect(entries[1].type).toBe('inproceedings')
  })

  it('handles entries with booktitle', () => {
    const bib = `@inproceedings{conf, booktitle={ICML 2023}, title={Deep Learning}}`
    const entries = parseBibtex(bib)
    expect(entries[0].booktitle).toBe('ICML 2023')
  })

  it('handles tildes as spaces', () => {
    const bib = `@article{key, author={van~der~Waals, Johannes}}`
    const entries = parseBibtex(bib)
    expect(entries[0].author).toBe('van der Waals, Johannes')
  })
})

describe('parseAuthors', () => {
  it('parses "Last, First" format', () => {
    const authors = parseAuthors('Smith, John')
    expect(authors).toEqual([{ first: 'John', last: 'Smith' }])
  })

  it('parses "First Last" format', () => {
    const authors = parseAuthors('John Smith')
    expect(authors).toEqual([{ first: 'John', last: 'Smith' }])
  })

  it('splits multiple authors on "and"', () => {
    const authors = parseAuthors('Smith, John and Doe, Jane')
    expect(authors).toHaveLength(2)
    expect(authors[0]).toEqual({ first: 'John', last: 'Smith' })
    expect(authors[1]).toEqual({ first: 'Jane', last: 'Doe' })
  })

  it('handles three or more authors', () => {
    const authors = parseAuthors('Alpha, A and Beta, B and Gamma, G')
    expect(authors).toHaveLength(3)
  })

  it('handles single-name authors', () => {
    const authors = parseAuthors('Aristotle')
    expect(authors).toEqual([{ first: '', last: 'Aristotle' }])
  })

  it('handles multi-word first names', () => {
    const authors = parseAuthors('Mary Jane Watson')
    expect(authors).toEqual([{ first: 'Mary Jane', last: 'Watson' }])
  })

  it('returns empty array for empty string', () => {
    expect(parseAuthors('')).toEqual([])
  })

  it('returns empty array for undefined', () => {
    expect(parseAuthors(undefined)).toEqual([])
  })
})

describe('formatAuthorsShort', () => {
  it('returns single author last name', () => {
    expect(formatAuthorsShort([{ first: 'John', last: 'Smith' }])).toBe('Smith')
  })

  it('joins two authors with &', () => {
    expect(formatAuthorsShort([
      { first: 'A', last: 'Smith' },
      { first: 'B', last: 'Doe' },
    ])).toBe('Smith & Doe')
  })

  it('uses et al. for three or more', () => {
    expect(formatAuthorsShort([
      { first: 'A', last: 'Smith' },
      { first: 'B', last: 'Doe' },
      { first: 'C', last: 'Lee' },
    ])).toBe('Smith et al.')
  })

  it('returns empty string for empty array', () => {
    expect(formatAuthorsShort([])).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatAuthorsShort(undefined)).toBe('')
  })
})

describe('formatAuthorsFull', () => {
  it('formats single author', () => {
    expect(formatAuthorsFull([{ first: 'John', last: 'Smith' }])).toBe('John Smith')
  })

  it('formats multiple authors comma-separated', () => {
    expect(formatAuthorsFull([
      { first: 'John', last: 'Smith' },
      { first: 'Jane', last: 'Doe' },
    ])).toBe('John Smith, Jane Doe')
  })

  it('handles author with empty first name', () => {
    expect(formatAuthorsFull([{ first: '', last: 'Aristotle' }])).toBe('Aristotle')
  })
})

describe('formatCitation', () => {
  const entry = { author: 'Smith, John and Doe, Jane', year: '2020' }

  it('formats numbered citation', () => {
    expect(formatCitation(entry, 'numbered', 0)).toBe('[1]')
    expect(formatCitation(entry, 'numbered', 4)).toBe('[5]')
  })

  it('formats author-year citation', () => {
    expect(formatCitation(entry, 'author-year', 0)).toBe('(Smith & Doe, 2020)')
  })

  it('handles single author for author-year', () => {
    const single = { author: 'Smith, John', year: '2020' }
    expect(formatCitation(single, 'author-year', 0)).toBe('(Smith, 2020)')
  })

  it('handles three+ authors for author-year', () => {
    const many = { author: 'A, X and B, Y and C, Z', year: '2020' }
    expect(formatCitation(many, 'author-year', 0)).toBe('(A et al., 2020)')
  })
})

describe('formatReference', () => {
  it('formats a complete reference', () => {
    const entry = {
      author: 'Smith, John',
      year: '2020',
      title: 'A Paper',
      journal: 'Nature',
      volume: '42',
      pages: '100-110',
      doi: '10.1234/test',
    }
    const ref = formatReference(entry, 0)
    expect(ref).toContain('[1]')
    expect(ref).toContain('John Smith')
    expect(ref).toContain('(2020)')
    expect(ref).toContain('A Paper')
    expect(ref).toContain('<em>Nature</em>')
    expect(ref).toContain('42')
    expect(ref).toContain('100-110')
    expect(ref).toContain('10.1234/test')
  })

  it('handles missing fields gracefully', () => {
    const entry = { title: 'Minimal Entry' }
    const ref = formatReference(entry, 2)
    expect(ref).toContain('[3]')
    expect(ref).toContain('Minimal Entry')
  })

  it('uses booktitle as fallback for journal', () => {
    const entry = { title: 'Paper', booktitle: 'ICML 2023' }
    const ref = formatReference(entry, 0)
    expect(ref).toContain('<em>ICML 2023</em>')
  })
})
