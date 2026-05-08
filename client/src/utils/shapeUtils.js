export const SHAPES = [
  { id: 'rect',         name: 'Rectangle',        icon: '▭' },
  { id: 'rounded-rect', name: 'Rounded Rect',      icon: '▢' },
  { id: 'circle',       name: 'Circle',            icon: '○' },
  { id: 'triangle',     name: 'Triangle',          icon: '△' },
  { id: 'diamond',      name: 'Diamond',           icon: '◇' },
  { id: 'arrow-right',  name: 'Arrow Right',       icon: '→' },
  { id: 'star',         name: 'Star',              icon: '★' },
  { id: 'line',         name: 'Line',              icon: '—' },
]

// Returns an SVG content string (for HTML export)
export function shapeSvgString(el) {
  const w = el.width, h = el.height
  const fill = el.fill || '#6366f1'
  const stroke = el.stroke || 'none'
  const sw = el.strokeWidth || 0
  const shape = el.shape || 'rect'

  const sda = el.strokeDasharray === 'dashed' ? `${sw*3} ${sw*2}` : el.strokeDasharray === 'dotted' ? `${sw} ${sw*1.5}` : ''
  const sdaAttr = sda ? ` stroke-dasharray="${sda}"` : ''

  let inner = ''
  if (shape === 'line') {
    const lw = el.strokeWidth || 3
    const lineColor = el.stroke && el.stroke !== 'none' ? el.stroke : (el.fill || '#ffffff')
    const lsda = el.strokeDasharray === 'dashed' ? `${lw*3} ${lw*2}` : el.strokeDasharray === 'dotted' ? `${lw} ${lw*1.5}` : ''
    const lsdaAttr = lsda ? ` stroke-dasharray="${lsda}"` : ''
    inner = `<line x1="${lw}" y1="${h/2}" x2="${w-lw}" y2="${h/2}" stroke="${lineColor}" stroke-width="${lw}"${lsdaAttr} fill="none" />`
  } else {
    let shapeEl = ''
    switch(shape) {
      case 'rect':
        shapeEl = `<rect x="${sw/2}" y="${sw/2}" width="${w-sw}" height="${h-sw}" rx="${el.borderRadius || 0}" />`; break
      case 'rounded-rect':
        shapeEl = `<rect x="${sw/2}" y="${sw/2}" width="${w-sw}" height="${h-sw}" rx="${Math.min(w,h)*0.15}" />`; break
      case 'circle':
        shapeEl = `<ellipse cx="${w/2}" cy="${h/2}" rx="${Math.max(0, w/2-sw/2)}" ry="${Math.max(0, h/2-sw/2)}" />`; break
      case 'triangle':
        shapeEl = `<polygon points="${w/2},${sw} ${w-sw},${h-sw} ${sw},${h-sw}" />`; break
      case 'diamond':
        shapeEl = `<polygon points="${w/2},${sw} ${w-sw},${h/2} ${w/2},${h-sw} ${sw},${h/2}" />`; break
      case 'arrow-right':
        shapeEl = `<polygon points="${sw},${h*0.35} ${w*0.6},${h*0.35} ${w*0.6},${sw} ${w-sw},${h/2} ${w*0.6},${h-sw} ${w*0.6},${h*0.65} ${sw},${h*0.65}" />`; break
      case 'star': {
        const cx = el.starCx != null ? el.starCx : w/2
        const cy = el.starCy != null ? el.starCy : h/2
        const outerR = el.starOuterR != null ? el.starOuterR : Math.min(w,h)/2-sw
        const innerR = el.starInnerR != null ? el.starInnerR : outerR*0.4
        const pts=[]
        for(let i=0;i<10;i++){const a=(Math.PI/5)*i-Math.PI/2;const r=i%2===0?outerR:innerR;pts.push(`${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`)}
        shapeEl = `<polygon points="${pts.join(' ')}" />`; break
      }
      default:
        shapeEl = `<rect x="${sw/2}" y="${sw/2}" width="${w-sw}" height="${h-sw}" />`
    }
    inner = `<g fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${sdaAttr}>${shapeEl}</g>`
  }

  let textEl = ''
  if (el.text) {
    const fs = el.fontSize || 16
    const tc = el.textColor || '#ffffff'
    textEl = `<text x="${w/2}" y="${h/2}" dominant-baseline="middle" text-anchor="middle" font-size="${fs}" fill="${tc}" style="font-family:inherit;">${el.text}</text>`
  }

  return `<svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="position:absolute;inset:0;overflow:visible;">${inner}${textEl}</svg>`
}
