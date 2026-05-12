// Animated Counter — host-side plugin entry point
export function activate(context) {
  context.log.info('Animated Counter plugin activated')

  context.exports.registerExportHook({
    formats: ['html'],
    handler: async (element) => {
      const d = element.data
      const val = Number(d.value) || 0
      const prefix = d.prefix || ''
      const suffix = d.suffix || ''
      const formatted = (d.separator !== false) ? Math.round(val).toLocaleString() : String(Math.round(val))
      const label = d.label ? `<div style="margin-top:6px;font-size:${d.labelSize || 16}px;color:${d.labelColor || 'rgba(255,255,255,0.6)'};font-weight:500;">${d.label}</div>` : ''
      return {
        html: `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,'Inter',sans-serif;">
          <div style="font-size:${d.fontSize || 64}px;font-weight:800;color:${d.color || '#ffffff'};letter-spacing:-2px;line-height:1;">${prefix}${formatted}${suffix}</div>
          ${label}
        </div>`
      }
    }
  })
}

export function deactivate() {}
