// Catmull-Rom spline → cubic bezier smooth SVG path
export function pointsToPath(points, smooth = true) {
  if (!points || points.length < 2) return ''
  if (!smooth || points.length < 3) {
    return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
  }
  const d = [`M ${points[0].x} ${points[0].y}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x} ${p2.y}`)
  }
  return d.join(' ')
}

// Ramer-Douglas-Peucker simplification — removes redundant collinear points
export function simplifyPoints(points, tolerance = 1.5) {
  if (!points || points.length <= 2) return points || []
  function perpDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2)
    return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len
  }
  function rdp(pts, eps) {
    if (pts.length <= 2) return pts
    let maxD = 0, maxI = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const d = perpDist(pts[i], pts[0], pts[pts.length - 1])
      if (d > maxD) { maxD = d; maxI = i }
    }
    if (maxD > eps) {
      const l = rdp(pts.slice(0, maxI + 1), eps)
      const r = rdp(pts.slice(maxI), eps)
      return [...l.slice(0, -1), ...r]
    }
    return [pts[0], pts[pts.length - 1]]
  }
  return rdp(points, tolerance)
}
