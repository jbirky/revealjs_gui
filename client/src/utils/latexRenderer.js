// Shared LaTeX iframe HTML generator
// Supports: KaTeX math, LaTeX tables via LaTeX.js, TikZ diagrams via TikZJax

export function generateLatexIframeHtml(content) {
  const hasTikz = /\\begin\{tikzpicture\}|\\tikz\s*[{[]/.test(content)
  const hasTable = /\\begin\{(tabular\*?|table\*?|longtable|tabularx|tabulary)\}/.test(content)

  if (hasTikz) {
    return `<!doctype html><html><head>
<meta charset="utf-8">
<link rel="stylesheet" type="text/css" href="https://tikzjax.com/v1/fonts.css">
<script src="https://tikzjax.com/v1/tikzjax.js"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: transparent; overflow: auto; color: white; }
  svg { max-width: 100%; max-height: 100%; }
</style>
</head><body><script type="text/tikz">${content}<\/script></body></html>`
  }

  if (hasTable) {
    const wrapped = content.includes('\\begin{document}') ? content
      : `\\documentclass{article}\n\\usepackage{booktabs}\n\\usepackage{array}\n\\begin{document}\n${content}\n\\end{document}`
    return `<!doctype html><html><head>
<meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/latex.js@0.12.6/dist/latex.js"><\/script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/latex.js@0.12.6/dist/base.css">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 8px; background: transparent; color: white !important; width: 100%; height: 100%; overflow: auto; font-family: 'Computer Modern', Georgia, serif; }
  table { border-collapse: collapse; color: white; }
  td, th { padding: 3px 10px; color: white !important; }
  p, span, div, .latex-table { color: white !important; }
  body > * { color: white !important; }
</style>
</head><body>
<div id="out"></div>
<script>try {
  var generator = new HtmlGenerator({ hyphenate: false })
  var doc = parse(${JSON.stringify(wrapped)}, { generator: generator })
  document.getElementById('out').appendChild(doc.domFragment())
} catch(e) {
  document.getElementById('out').innerHTML = '<span style="color:#f87171">Error: ' + e.message + '<\/span>'
}
<\/script>
</body></html>`
  }

  // KaTeX for math expressions
  return `<!doctype html><html><head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: transparent; overflow: hidden; color: white; }
  .katex { font-size: 1.4em; }
  svg { max-width: 100%; max-height: 100%; }
</style>
</head><body>
<div id="math"></div>
<script>
  try {
    katex.render(${JSON.stringify(content)}, document.getElementById('math'), { displayMode: true, throwOnError: false });
  } catch(e) {
    document.getElementById('math').textContent = e.message;
  }
<\/script>
</body></html>`
}
