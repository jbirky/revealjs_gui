export function activate(context) {
  context.log.info('Linear Algebra plugin activated')

  context.exports.registerExportHook({
    formats: ['html'],
    handler: async (element) => {
      const d = element.data
      const bg = d.bgColor || '#0f0f1a'
      const color = d.color || '#fff'

      if (d.mode === 'matrix') {
        const entries = d.entries || [[1, 0], [0, 1]]
        const name = d.name || ''
        const fs = d.fontSize || 24
        let html = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:${bg};font-family:monospace;color:${color};font-size:${fs}px;">`
        if (name) html += `<span style="font-style:italic;font-family:Georgia,serif;margin-right:12px;">${name} =</span>`
        html += `<table style="border-collapse:collapse;border-left:2px solid ${color};border-right:2px solid ${color};padding:0 6px;">`
        for (const row of entries) {
          html += '<tr>'
          for (const val of row) html += `<td style="padding:4px 10px;text-align:center;">${val}</td>`
          html += '</tr>'
        }
        html += '</table></div>'
        return { html }
      }

      if (d.mode === 'operation') {
        const A = d.matrixA || [[1, 0], [0, 1]]
        const B = d.matrixB || [[1, 0], [0, 1]]
        const rA = A.length, cA = A[0].length, cB = B[0].length
        const C = A.map((row, i) => B[0].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)))
        const matHtml = (m) => {
          let h = `<table style="border-collapse:collapse;border-left:2px solid ${color};border-right:2px solid ${color};padding:0 4px;display:inline-table;vertical-align:middle;">`
          for (const row of m) { h += '<tr>'; for (const v of row) h += `<td style="padding:3px 8px;text-align:center;">${v}</td>`; h += '</tr>' }
          return h + '</table>'
        }
        return {
          html: `<div style="display:flex;align-items:center;justify-content:center;gap:16px;width:100%;height:100%;background:${bg};font-family:monospace;color:${color};font-size:${d.fontSize || 22}px;">
            ${matHtml(A)}<span style="opacity:0.5;">×</span>${matHtml(B)}<span style="opacity:0.5;">=</span>${matHtml(C)}
          </div>`
        }
      }

      return {
        html: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${bg};color:rgba(255,255,255,0.4);font-size:13px;font-family:-apple-system,sans-serif;">
          <div style="text-align:center;">
            <div style="font-size:28px;margin-bottom:8px;">Linear Transform</div>
            <div style="font-family:monospace;font-size:12px;">[${(d.matrix||[[1,0],[0,1]]).map(r=>r.join(', ')).join(' | ')}]</div>
          </div>
        </div>`
      }
    }
  })
}

export function deactivate() {}
