// Manim Animations — host-side plugin entry point
export function activate(context) {
  context.log.info('Manim plugin activated')

  context.exports.registerExportHook({
    formats: ['html'],
    handler: async (element) => {
      const d = element.data
      if (d.rendered) {
        const attrs = []
        if (d.controls) attrs.push('controls')
        if (d.autoplay !== false) attrs.push('autoplay')
        if (d.loop !== false) attrs.push('loop')
        if (d.muted !== false) attrs.push('muted')
        return {
          html: `<video src="${d.rendered}" ${attrs.join(' ')} style="width:100%;height:100%;object-fit:contain;display:block;background:#000;"></video>`
        }
      }
      return {
        html: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#000;color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:14px;">Manim: ${d.sceneName || 'MyScene'} (not rendered)</div>`
      }
    }
  })
}

export function deactivate() {}
