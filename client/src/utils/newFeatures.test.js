import { describe, it, expect } from 'vitest'

// Re-implement the helpers since they're not exported from HomePage.jsx
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i]
}

function fileIcon(contentType) {
  if (!contentType) return 'File'
  if (contentType.startsWith('image/')) return 'Image'
  if (contentType.startsWith('video/')) return 'Film'
  if (contentType.startsWith('audio/')) return 'Music'
  if (contentType === 'application/pdf') return 'FileText'
  return 'File'
}

describe('formatBytes', () => {
  it('returns 0 B for zero', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('returns 0 B for null/undefined', () => {
    expect(formatBytes(null)).toBe('0 B')
    expect(formatBytes(undefined)).toBe('0 B')
  })

  it('formats bytes correctly', () => {
    expect(formatBytes(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB')
    expect(formatBytes(104857600)).toBe('100.0 MB')
  })

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB')
    expect(formatBytes(5368709120)).toBe('5.0 GB')
  })

  it('formats terabytes', () => {
    expect(formatBytes(1099511627776)).toBe('1.0 TB')
  })
})

describe('fileIcon', () => {
  it('returns File for null/undefined', () => {
    expect(fileIcon(null)).toBe('File')
    expect(fileIcon(undefined)).toBe('File')
  })

  it('returns Image for image types', () => {
    expect(fileIcon('image/png')).toBe('Image')
    expect(fileIcon('image/jpeg')).toBe('Image')
    expect(fileIcon('image/svg+xml')).toBe('Image')
    expect(fileIcon('image/webp')).toBe('Image')
  })

  it('returns Film for video types', () => {
    expect(fileIcon('video/mp4')).toBe('Film')
    expect(fileIcon('video/webm')).toBe('Film')
  })

  it('returns Music for audio types', () => {
    expect(fileIcon('audio/mpeg')).toBe('Music')
    expect(fileIcon('audio/wav')).toBe('Music')
  })

  it('returns FileText for PDF', () => {
    expect(fileIcon('application/pdf')).toBe('FileText')
  })

  it('returns File for unknown types', () => {
    expect(fileIcon('application/json')).toBe('File')
    expect(fileIcon('text/plain')).toBe('File')
  })
})

describe('upload filter logic', () => {
  const uploads = [
    { id: '1', name: 'photo.png', contentType: 'image/png', presentationTitle: 'My Talk', size: 1024 },
    { id: '2', name: 'video.mp4', contentType: 'video/mp4', presentationTitle: 'Demo', size: 5000000 },
    { id: '3', name: 'chart.svg', contentType: 'image/svg+xml', presentationTitle: 'My Talk', size: 2048 },
    { id: '4', name: 'notes.pdf', contentType: 'application/pdf', presentationTitle: null, size: 50000 },
  ]

  function filterUploads(list, query) {
    if (!query) return list
    const q = query.toLowerCase()
    return list.filter(u =>
      (u.name || '').toLowerCase().includes(q)
      || (u.presentationTitle || '').toLowerCase().includes(q)
      || (u.contentType || '').toLowerCase().includes(q)
    )
  }

  it('returns all uploads when filter is empty', () => {
    expect(filterUploads(uploads, '')).toHaveLength(4)
    expect(filterUploads(uploads, null)).toHaveLength(4)
  })

  it('filters by filename', () => {
    expect(filterUploads(uploads, 'photo')).toHaveLength(1)
    expect(filterUploads(uploads, 'photo')[0].name).toBe('photo.png')
  })

  it('filters by content type', () => {
    expect(filterUploads(uploads, 'video')).toHaveLength(1)
    expect(filterUploads(uploads, 'image')).toHaveLength(2)
  })

  it('filters by presentation title', () => {
    expect(filterUploads(uploads, 'my talk')).toHaveLength(2)
    expect(filterUploads(uploads, 'demo')).toHaveLength(1)
  })

  it('is case-insensitive', () => {
    expect(filterUploads(uploads, 'PHOTO')).toHaveLength(1)
    expect(filterUploads(uploads, 'MY TALK')).toHaveLength(2)
  })

  it('returns empty for non-matching query', () => {
    expect(filterUploads(uploads, 'nonexistent')).toHaveLength(0)
  })
})

describe('GitHub URL parsing', () => {
  function parseGithubUrl(url) {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/)
    if (!match) return null
    return { owner: match[1], repo: match[2] }
  }

  it('parses standard GitHub URL', () => {
    expect(parseGithubUrl('https://github.com/user/repo')).toEqual({ owner: 'user', repo: 'repo' })
  })

  it('parses URL with trailing slash', () => {
    expect(parseGithubUrl('https://github.com/user/repo/')).toEqual({ owner: 'user', repo: 'repo' })
  })

  it('parses URL with .git suffix', () => {
    expect(parseGithubUrl('https://github.com/user/repo.git')).toEqual({ owner: 'user', repo: 'repo' })
  })

  it('parses URL with subpath', () => {
    expect(parseGithubUrl('https://github.com/org/my-repo/tree/main')).toEqual({ owner: 'org', repo: 'my-repo' })
  })

  it('returns null for invalid URL', () => {
    expect(parseGithubUrl('https://gitlab.com/user/repo')).toBeNull()
    expect(parseGithubUrl('not a url')).toBeNull()
  })

  it('handles org names with hyphens', () => {
    expect(parseGithubUrl('https://github.com/my-org/my-repo')).toEqual({ owner: 'my-org', repo: 'my-repo' })
  })
})

describe('Zenodo metadata preparation', () => {
  function prepareZenodoMeta(zenodoMeta) {
    return {
      creators: zenodoMeta.creators.filter(c => c.name.trim()),
      description: zenodoMeta.description.trim() || undefined,
      keywords: zenodoMeta.keywords.trim()
        ? zenodoMeta.keywords.split(',').map(k => k.trim()).filter(Boolean)
        : undefined,
      license: zenodoMeta.license || undefined,
    }
  }

  it('filters out empty creator names', () => {
    const meta = prepareZenodoMeta({
      creators: [{ name: 'Birky, Jessica', affiliation: 'UW' }, { name: '', affiliation: '' }],
      description: 'A talk',
      keywords: '',
      license: 'cc-by-4.0',
    })
    expect(meta.creators).toHaveLength(1)
    expect(meta.creators[0].name).toBe('Birky, Jessica')
  })

  it('trims whitespace-only creator names', () => {
    const meta = prepareZenodoMeta({
      creators: [{ name: '  ', affiliation: '' }, { name: 'Smith, John', affiliation: '' }],
      description: '',
      keywords: '',
      license: '',
    })
    expect(meta.creators).toHaveLength(1)
    expect(meta.creators[0].name).toBe('Smith, John')
  })

  it('sets description to undefined when empty', () => {
    const meta = prepareZenodoMeta({
      creators: [{ name: 'A', affiliation: '' }],
      description: '  ',
      keywords: '',
      license: 'cc-by-4.0',
    })
    expect(meta.description).toBeUndefined()
  })

  it('parses comma-separated keywords', () => {
    const meta = prepareZenodoMeta({
      creators: [{ name: 'A', affiliation: '' }],
      description: 'test',
      keywords: 'astronomy, stars, spectroscopy',
      license: 'cc-by-4.0',
    })
    expect(meta.keywords).toEqual(['astronomy', 'stars', 'spectroscopy'])
  })

  it('filters empty keywords', () => {
    const meta = prepareZenodoMeta({
      creators: [{ name: 'A', affiliation: '' }],
      description: '',
      keywords: 'one,,  , two',
      license: '',
    })
    expect(meta.keywords).toEqual(['one', 'two'])
  })

  it('sets keywords to undefined when empty string', () => {
    const meta = prepareZenodoMeta({
      creators: [{ name: 'A', affiliation: '' }],
      description: '',
      keywords: '',
      license: '',
    })
    expect(meta.keywords).toBeUndefined()
  })

  it('preserves license value', () => {
    const meta = prepareZenodoMeta({
      creators: [{ name: 'A', affiliation: '' }],
      description: '',
      keywords: '',
      license: 'cc-by-sa-4.0',
    })
    expect(meta.license).toBe('cc-by-sa-4.0')
  })

  it('sets license to undefined when empty', () => {
    const meta = prepareZenodoMeta({
      creators: [{ name: 'A', affiliation: '' }],
      description: '',
      keywords: '',
      license: '',
    })
    expect(meta.license).toBeUndefined()
  })
})

describe('Zenodo citation slide generation', () => {
  function generateBibtex(title, creators, doi, year) {
    const firstAuthorLast = (creators[0]?.name || 'Author').split(',')[0].trim().toLowerCase().replace(/\s+/g, '')
    const bibKey = `${firstAuthorLast}${year}${(title || 'presentation').split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '')}`
    return {
      key: bibKey,
      bibtex: [
        `@misc{${bibKey},`,
        `  author    = {${creators.map(c => c.name).join(' and ')}},`,
        `  title     = {${title}},`,
        `  year      = {${year}},`,
        `  publisher = {Zenodo},`,
        `  doi       = {${doi}},`,
        `  url       = {https://doi.org/${doi}}`,
        `}`,
      ].join('\n'),
    }
  }

  it('generates correct BibTeX key from single author', () => {
    const { key } = generateBibtex('Stellar Evolution', [{ name: 'Birky, Jessica' }], '10.5281/zenodo.123', 2026)
    expect(key).toBe('birky2026stellar')
  })

  it('generates key from first author when multiple', () => {
    const { key } = generateBibtex('Cool Stars', [{ name: 'Smith, John' }, { name: 'Doe, Jane' }], '10.5281/zenodo.456', 2026)
    expect(key).toBe('smith2026cool')
  })

  it('includes all authors in BibTeX', () => {
    const { bibtex } = generateBibtex('Talk', [{ name: 'A, B' }, { name: 'C, D' }], '10.5281/zenodo.1', 2026)
    expect(bibtex).toContain('author    = {A, B and C, D}')
  })

  it('includes DOI and URL', () => {
    const { bibtex } = generateBibtex('Talk', [{ name: 'X, Y' }], '10.5281/zenodo.789', 2026)
    expect(bibtex).toContain('doi       = {10.5281/zenodo.789}')
    expect(bibtex).toContain('url       = {https://doi.org/10.5281/zenodo.789}')
  })

  it('includes title and year', () => {
    const { bibtex } = generateBibtex('My Presentation', [{ name: 'X, Y' }], '10.5281/zenodo.1', 2025)
    expect(bibtex).toContain('title     = {My Presentation}')
    expect(bibtex).toContain('year      = {2025}')
  })

  it('handles title with leading non-alpha characters in key', () => {
    const { key } = generateBibtex('100% Cool! Stuff', [{ name: 'Test, Author' }], '10.5281/zenodo.1', 2026)
    // first word "100%" becomes empty after stripping non-alpha
    expect(key).toBe('test2026')
  })

  it('handles normal title in key', () => {
    const { key } = generateBibtex('Cool Stuff', [{ name: 'Test, Author' }], '10.5281/zenodo.1', 2026)
    expect(key).toBe('test2026cool')
  })
})

describe('storage quota calculations', () => {
  it('computes usage percentage correctly', () => {
    const used = 50 * 1024 * 1024 // 50 MB
    const limit = 100 * 1024 * 1024 // 100 MB
    const pct = (used / limit) * 100
    expect(pct).toBe(50)
  })

  it('caps at 100%', () => {
    const used = 150 * 1024 * 1024
    const limit = 100 * 1024 * 1024
    const pct = Math.min(100, (used / limit) * 100)
    expect(pct).toBe(100)
  })

  it('determines color based on usage threshold', () => {
    function getBarColor(used, limit) {
      const ratio = used / limit
      if (ratio > 0.9) return 'red'
      if (ratio > 0.7) return 'amber'
      return 'accent'
    }
    expect(getBarColor(95, 100)).toBe('red')
    expect(getBarColor(75, 100)).toBe('amber')
    expect(getBarColor(50, 100)).toBe('accent')
    expect(getBarColor(0, 100)).toBe('accent')
  })
})

describe('fork presentation path rewriting', () => {
  it('rewrites relative asset paths', () => {
    const pathMap = {
      './assets/image.png': '/uploads/abc123.png',
      './assets/video.mp4': '/uploads/def456.mp4',
    }
    function rewrite(str) {
      let result = str
      for (const [oldPath, newPath] of Object.entries(pathMap)) {
        result = result.split(oldPath).join(newPath)
      }
      return result
    }

    const input = JSON.stringify({
      slides: [{ elements: [{ src: './assets/image.png' }, { src: './assets/video.mp4' }] }]
    })
    const output = rewrite(input)
    expect(output).toContain('/uploads/abc123.png')
    expect(output).toContain('/uploads/def456.mp4')
    expect(output).not.toContain('./assets/')
  })

  it('handles presentations with no assets', () => {
    const pathMap = {}
    function rewrite(str) {
      let result = str
      for (const [oldPath, newPath] of Object.entries(pathMap)) {
        result = result.split(oldPath).join(newPath)
      }
      return result
    }
    const input = '{"slides":[{"elements":[{"type":"text","content":"hello"}]}]}'
    expect(rewrite(input)).toBe(input)
  })
})
