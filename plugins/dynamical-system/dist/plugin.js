// Dynamical System — host-side plugin entry point
export function activate(context) {
  context.log.info('Dynamical System plugin activated')

  context.exports.registerExportHook({
    formats: ['html'],
    handler: async (element) => {
      const d = element.data
      return {
        html: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${d.bgColor || '#0f0f1a'};border-radius:4px;font-family:-apple-system,sans-serif;">
          <div style="text-align:center;color:rgba(255,255,255,0.4);font-size:13px;">
            <div style="font-size:28px;margin-bottom:8px;">Dynamical System</div>
            <div style="font-family:monospace;font-size:12px;">dx/dt = ${d.dxdt || '?'}</div>
            <div style="font-family:monospace;font-size:12px;">dy/dt = ${d.dydt || '?'}</div>
            <div style="margin-top:6px;font-size:10px;opacity:0.6;">${(d.trajectories || []).length} trajectories</div>
          </div>
        </div>`
      }
    }
  })
}

export function deactivate() {}
