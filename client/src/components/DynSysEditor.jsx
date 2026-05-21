// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useRef, useEffect, useCallback } from 'react'

const TRAJ_COLORS = ['#f472b6','#34d399','#fbbf24','#60a5fa','#a78bfa','#f87171','#38bdf8','#fb923c']
const PRESETS_2D = {
  pendulum: { dxdt:'y', dydt:'-sin(x) - 0.3*y', dzdt:'', xMin:-8,xMax:8,yMin:-5,yMax:5, trajectories:[{x:1,y:0},{x:-3,y:2},{x:5,y:-1}] },
  vanderpol: { dxdt:'y', dydt:'2*(1 - x^2)*y - x', dzdt:'', xMin:-5,xMax:5,yMin:-5,yMax:5, trajectories:[{x:0.1,y:0},{x:3,y:3},{x:-2,y:-4}] },
  lotka: { dxdt:'x*(1.5 - y)', dydt:'y*(x - 1)', dzdt:'', xMin:-0.5,xMax:5,yMin:-0.5,yMax:5, trajectories:[{x:1,y:1},{x:2,y:3},{x:0.5,y:0.5}] },
  saddle: { dxdt:'x', dydt:'-y', dzdt:'', xMin:-4,xMax:4,yMin:-4,yMax:4, trajectories:[{x:1,y:1},{x:-1,y:2},{x:2,y:-1},{x:-2,y:-2}] },
  spiral: { dxdt:'-0.5*x + y', dydt:'-x - 0.5*y', dzdt:'', xMin:-4,xMax:4,yMin:-4,yMax:4, trajectories:[{x:3,y:0},{x:-2,y:2},{x:0,y:-3}] },
  center: { dxdt:'y', dydt:'-x', dzdt:'', xMin:-4,xMax:4,yMin:-4,yMax:4, trajectories:[{x:1,y:0},{x:2,y:0},{x:3,y:0}] },
  duffing: { dxdt:'y', dydt:'x - x^3 - 0.2*y', dzdt:'', xMin:-3,xMax:3,yMin:-2,yMax:2, trajectories:[{x:0.1,y:0},{x:-0.1,y:0},{x:1.5,y:1}] },
}
const PRESETS_3D = {
  lorenz: { dxdt:'10*(y-x)', dydt:'x*(28-z)-y', dzdt:'x*y-8/3*z', xMin:-25,xMax:25,yMin:-30,yMax:30, trajectories:[{x:1,y:1,z:1},{x:-5,y:-5,z:25}], dt:0.005, maxSteps:12000, tMax:50 },
  rossler: { dxdt:'-y-z', dydt:'x+0.2*y', dzdt:'0.2+z*(x-5.7)', xMin:-15,xMax:15,yMin:-15,yMax:15, trajectories:[{x:1,y:1,z:0}], dt:0.01, maxSteps:10000, tMax:80 },
  chen: { dxdt:'35*(y-x)', dydt:'-7*x+28*y-x*z', dzdt:'x*y-3*z', xMin:-30,xMax:30,yMin:-30,yMax:30, trajectories:[{x:1,y:1,z:1}], dt:0.003, maxSteps:15000, tMax:40 },
  thomas: { dxdt:'sin(y)-0.2*x', dydt:'sin(z)-0.2*y', dzdt:'sin(x)-0.2*z', xMin:-4,xMax:4,yMin:-4,yMax:4, trajectories:[{x:1,y:0,z:0},{x:0.1,y:0.1,z:-0.1}], dt:0.03, maxSteps:8000, tMax:200 },
  aizawa: { dxdt:'(z-0.7)*x-3.5*y', dydt:'3.5*x+(z-0.7)*y', dzdt:'0.6+0.95*z-z^3/3-(x^2+y^2)*(1+0.25*z)+0.1*z*x^3', xMin:-2,xMax:2,yMin:-2,yMax:2, trajectories:[{x:0.1,y:0,z:0}], dt:0.005, maxSteps:15000, tMax:60 },
}
const ALL_PRESETS = { ...PRESETS_2D, ...PRESETS_3D }

// ---- Expression parser (same as sandbox) ----
function tokenize(s) {
  const t = []; let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === ' ') { i++; continue }
    if ('+-*/^(),'.includes(c)) { t.push({type:'op',val:c}); i++; continue }
    if ((c >= '0' && c <= '9') || c === '.') {
      let n = ''
      while (i < s.length && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) n += s[i++]
      t.push({type:'num',val:parseFloat(n)}); continue
    }
    if (/[a-zA-Z_]/.test(c)) {
      let id = ''
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) id += s[i++]
      t.push({type:'id',val:id}); continue
    }
    i++
  }
  return t
}
function peek(t,p) { return p.i < t.length ? t[p.i] : null }
function eat(t,p) { return t[p.i++] }
function parseAdd(t,p) { let left = parseMul(t,p); while (peek(t,p) && (peek(t,p).val==='+' || peek(t,p).val==='-')) { const op = eat(t,p).val; left = {op, a:left, b:parseMul(t,p)} } return left }
function parseMul(t,p) { let left = parsePow(t,p); while (peek(t,p) && (peek(t,p).val==='*' || peek(t,p).val==='/')) { const op = eat(t,p).val; left = {op, a:left, b:parsePow(t,p)} } return left }
function parsePow(t,p) { let left = parseUnary(t,p); if (peek(t,p) && peek(t,p).val==='^') { eat(t,p); left = {op:'^', a:left, b:parsePow(t,p)} } return left }
function parseUnary(t,p) { if (peek(t,p) && peek(t,p).val==='-') { eat(t,p); return {op:'neg', a:parseUnary(t,p)} } if (peek(t,p) && peek(t,p).val==='+') { eat(t,p); return parseUnary(t,p) } return parseAtom(t,p) }
function parseAtom(t,p) {
  const tk = peek(t,p)
  if (!tk) return {op:'num',val:0}
  if (tk.type==='num') { eat(t,p); return {op:'num',val:tk.val} }
  if (tk.type==='id') {
    eat(t,p)
    if (peek(t,p) && peek(t,p).val==='(') { eat(t,p); const args = [parseAdd(t,p)]; while (peek(t,p) && peek(t,p).val===',') { eat(t,p); args.push(parseAdd(t,p)) } if (peek(t,p) && peek(t,p).val===')') eat(t,p); return {op:'fn',name:tk.val,args} }
    if (tk.val==='pi') return {op:'num',val:Math.PI}
    if (tk.val==='e') return {op:'num',val:Math.E}
    return {op:'var',name:tk.val}
  }
  if (tk.val==='(') { eat(t,p); const inner = parseAdd(t,p); if (peek(t,p)&&peek(t,p).val===')') eat(t,p); return inner }
  eat(t,p); return {op:'num',val:0}
}
const FNS = {sin:Math.sin,cos:Math.cos,tan:Math.tan,exp:Math.exp,log:Math.log,sqrt:Math.sqrt,abs:Math.abs,atan:Math.atan,atan2:Math.atan2,tanh:Math.tanh,sign:Math.sign,asin:Math.asin,acos:Math.acos,pow:Math.pow,min:Math.min,max:Math.max}
function evalAST(node,vars) {
  if (node.op==='num') return node.val; if (node.op==='var') return vars[node.name]||0; if (node.op==='neg') return -evalAST(node.a,vars)
  if (node.op==='+') return evalAST(node.a,vars)+evalAST(node.b,vars); if (node.op==='-') return evalAST(node.a,vars)-evalAST(node.b,vars)
  if (node.op==='*') return evalAST(node.a,vars)*evalAST(node.b,vars); if (node.op==='/') { const d=evalAST(node.b,vars); return d===0?0:evalAST(node.a,vars)/d }
  if (node.op==='^') return Math.pow(evalAST(node.a,vars),evalAST(node.b,vars))
  if (node.op==='fn') { const fn=FNS[node.name]; if(!fn) return 0; return fn(...node.args.map(n=>evalAST(n,vars))) }
  return 0
}
function compileExpr(str) { try { const ast = parseAdd(tokenize(str||'0'),{i:0}); return (x,y,z)=>evalAST(ast,{x,y,z:z||0}) } catch { return ()=>0 } }

// ---- RK4 ----
function integrateForward(fx,fy,x0,y0,dt,steps,bounds) {
  const pts = [{t:0,x:x0,y:y0}]; let x=x0,y=y0
  const [xLo,xHi,yLo,yHi] = bounds ? [bounds.xMin-2,bounds.xMax+2,bounds.yMin-2,bounds.yMax+2] : [-1e6,1e6,-1e6,1e6]
  for (let i=0;i<steps;i++) {
    const k1x=fx(x,y),k1y=fy(x,y), k2x=fx(x+dt/2*k1x,y+dt/2*k1y),k2y=fy(x+dt/2*k1x,y+dt/2*k1y)
    const k3x=fx(x+dt/2*k2x,y+dt/2*k2y),k3y=fy(x+dt/2*k2x,y+dt/2*k2y), k4x=fx(x+dt*k3x,y+dt*k3y),k4y=fy(x+dt*k3x,y+dt*k3y)
    x+=dt/6*(k1x+2*k2x+2*k3x+k4x); y+=dt/6*(k1y+2*k2y+2*k3y+k4y)
    if (isNaN(x)||isNaN(y)||x<xLo||x>xHi||y<yLo||y>yHi) break
    pts.push({t:(i+1)*dt,x,y})
  }
  return pts
}
function integrateBoth(fx,fy,x0,y0,dt,steps,bounds) {
  const fwd = integrateForward(fx,fy,x0,y0,dt,steps,bounds)
  const bwd = integrateForward(fx,fy,x0,y0,-dt,steps,bounds); bwd.reverse(); bwd.pop()
  return bwd.concat(fwd)
}
function integrateForward3D(fx,fy,fz,x0,y0,z0,dt,steps) {
  const pts = [{t:0,x:x0,y:y0,z:z0}]; let x=x0,y=y0,z=z0
  for (let i=0;i<steps;i++) {
    const k1x=fx(x,y,z),k1y=fy(x,y,z),k1z=fz(x,y,z)
    const k2x=fx(x+dt/2*k1x,y+dt/2*k1y,z+dt/2*k1z),k2y=fy(x+dt/2*k1x,y+dt/2*k1y,z+dt/2*k1z),k2z=fz(x+dt/2*k1x,y+dt/2*k1y,z+dt/2*k1z)
    const k3x=fx(x+dt/2*k2x,y+dt/2*k2y,z+dt/2*k2z),k3y=fy(x+dt/2*k2x,y+dt/2*k2y,z+dt/2*k2z),k3z=fz(x+dt/2*k2x,y+dt/2*k2y,z+dt/2*k2z)
    const k4x=fx(x+dt*k3x,y+dt*k3y,z+dt*k3z),k4y=fy(x+dt*k3x,y+dt*k3y,z+dt*k3z),k4z=fz(x+dt*k3x,y+dt*k3y,z+dt*k3z)
    x+=dt/6*(k1x+2*k2x+2*k3x+k4x); y+=dt/6*(k1y+2*k2y+2*k3y+k4y); z+=dt/6*(k1z+2*k2z+2*k3z+k4z)
    if (isNaN(x)||isNaN(y)||isNaN(z)||Math.abs(x)>1e6||Math.abs(y)>1e6||Math.abs(z)>1e6) break
    pts.push({t:(i+1)*dt,x,y,z})
  }
  return pts
}

// ---- Fixed points ----
function findFixedPoints(fx,fy,xMin,xMax,yMin,yMax) {
  const pts = [], n=12, dx=(xMax-xMin)/n, dy=(yMax-yMin)/n
  for (let i=0;i<=n;i++) for (let j=0;j<=n;j++) {
    let x=xMin+i*dx, y=yMin+j*dy
    for (let k=0;k<20;k++) {
      const f=fx(x,y),g=fy(x,y)
      if (Math.abs(f)<1e-10&&Math.abs(g)<1e-10) break
      const h=1e-6, fx1=(fx(x+h,y)-f)/h,fx2=(fx(x,y+h)-f)/h, fy1=(fy(x+h,y)-g)/h,fy2=(fy(x,y+h)-g)/h
      const det=fx1*fy2-fx2*fy1; if (Math.abs(det)<1e-14) break
      x-=(fy2*f-fx2*g)/det; y-=(fx1*g-fy1*f)/det
    }
    if (Math.abs(fx(x,y))<1e-6&&Math.abs(fy(x,y))<1e-6&&x>=xMin&&x<=xMax&&y>=yMin&&y<=yMax) {
      if (!pts.some(p=>Math.abs(p.x-x)<0.05&&Math.abs(p.y-y)<0.05)) {
        const h2=1e-5, J11=(fx(x+h2,y)-fx(x-h2,y))/(2*h2),J12=(fx(x,y+h2)-fx(x,y-h2))/(2*h2)
        const J21=(fy(x+h2,y)-fy(x-h2,y))/(2*h2),J22=(fy(x,y+h2)-fy(x,y-h2))/(2*h2)
        const tr=J11+J22,det2=J11*J22-J12*J21,disc=tr*tr-4*det2
        let cls='unknown'
        if (det2<0) cls='saddle'; else if (disc<0) cls=tr<0?'stable-spiral':'unstable-spiral'; else cls=tr<0?'stable-node':'unstable-node'
        if (Math.abs(tr)<1e-8&&det2>0) cls='center'
        pts.push({x,y,type:cls})
      }
    }
  }
  return pts
}

function niceStep(range) { const raw=range/6,mag=Math.pow(10,Math.floor(Math.log10(raw))),norm=raw/mag; if(norm<=1.5)return mag; if(norm<=3)return 2*mag; if(norm<=7)return 5*mag; return 10*mag }
function fmt(v) { return Math.abs(v)<1e-10?'0':(Math.abs(v)>=1000||(Math.abs(v)<0.01&&v!==0))?v.toExponential(1):parseFloat(v.toPrecision(4)).toString() }

// ---- Phase portrait canvas renderer ----
function drawPhase(canvas, d, trajData) {
  const c = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const cw = canvas.clientWidth, ch = canvas.clientHeight
  canvas.width = cw * dpr; canvas.height = ch * dpr
  c.setTransform(dpr,0,0,dpr,0,0)

  const fx = compileExpr(d.dxdt), fy = compileExpr(d.dydt)
  const W = cw, H = ch
  const toSx = x => (x-d.xMin)/(d.xMax-d.xMin)*W
  const toSy = y => (1-(y-d.yMin)/(d.yMax-d.yMin))*H

  c.fillStyle = d.bgColor || '#0f0f1a'; c.fillRect(0,0,cw,ch)
  c.save(); c.beginPath(); c.rect(0,0,W,H); c.clip()

  const xRange=d.xMax-d.xMin, yRange=d.yMax-d.yMin
  const xStep=niceStep(xRange), yStep=niceStep(yRange)
  c.strokeStyle='rgba(255,255,255,0.08)'; c.lineWidth=0.5
  c.font='10px -apple-system,sans-serif'; c.fillStyle='rgba(255,255,255,0.25)'
  c.textAlign='center'; c.textBaseline='top'
  for (let gx=Math.ceil(d.xMin/xStep)*xStep;gx<=d.xMax;gx+=xStep) { const sx=toSx(gx); c.beginPath();c.moveTo(sx,0);c.lineTo(sx,H);c.stroke(); c.fillText(fmt(gx),sx,H-14) }
  c.textAlign='right'; c.textBaseline='middle'
  for (let gy=Math.ceil(d.yMin/yStep)*yStep;gy<=d.yMax;gy+=yStep) { const sy=toSy(gy); c.beginPath();c.moveTo(0,sy);c.lineTo(W,sy);c.stroke(); c.fillText(fmt(gy),28,sy) }
  c.strokeStyle='rgba(255,255,255,0.18)'; c.lineWidth=1
  if (d.xMin<=0&&d.xMax>=0) { const ox=toSx(0); c.beginPath();c.moveTo(ox,0);c.lineTo(ox,H);c.stroke() }
  if (d.yMin<=0&&d.yMax>=0) { const oy=toSy(0); c.beginPath();c.moveTo(0,oy);c.lineTo(W,oy);c.stroke() }

  if (d.showField !== false) {
    const gd=d.gridDensity||18, arrowLen=Math.min(W,H)/gd*0.38
    c.strokeStyle=d.fieldColor||'rgba(100,160,255,0.35)'; c.lineWidth=1
    for (let i=0;i<=gd;i++) for (let j=0;j<=gd;j++) {
      const wx=d.xMin+(i+0.5)/(gd+1)*xRange, wy=d.yMin+(j+0.5)/(gd+1)*yRange
      const vx=fx(wx,wy),vy=fy(wx,wy),mag=Math.sqrt(vx*vx+vy*vy)
      if (mag<1e-12) continue
      const nx=vx/mag,ny=vy/mag,sx=toSx(wx),sy=toSy(wy)
      const x1=sx-nx*arrowLen*0.4,y1=sy+ny*arrowLen*0.4,x2=sx+nx*arrowLen*0.6,y2=sy-ny*arrowLen*0.6
      const len=Math.sqrt((x2-x1)**2+(y2-y1)**2); if(len<0.5)continue
      const ux=(x2-x1)/len,uy=(y2-y1)/len
      c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.moveTo(x2,y2);c.lineTo(x2-ux*3.5+uy*1.4,y2-uy*3.5-ux*1.4);c.moveTo(x2,y2);c.lineTo(x2-ux*3.5-uy*1.4,y2-uy*3.5+ux*1.4);c.stroke()
    }
  }

  if (d.showNullclines) {
    const drawNc = (fn, color) => {
      const res=80, ddx=(d.xMax-d.xMin)/res,ddy=(d.yMax-d.yMin)/res
      c.strokeStyle=color;c.lineWidth=1.5;c.setLineDash([4,3]);c.beginPath()
      for(let i=0;i<res;i++)for(let j=0;j<res;j++){const x0=d.xMin+i*ddx,y0=d.yMin+j*ddy,v00=fn(x0,y0),v10=fn(x0+ddx,y0),v01=fn(x0,y0+ddy),v11=fn(x0+ddx,y0+ddy),edges=[];if(v00*v10<0)edges.push({x:x0+ddx*(-v00)/(v10-v00),y:y0});if(v10*v11<0)edges.push({x:x0+ddx,y:y0+ddy*(-v10)/(v11-v10)});if(v01*v11<0)edges.push({x:x0+ddx*(-v01)/(v11-v01),y:y0+ddy});if(v00*v01<0)edges.push({x:x0,y:y0+ddy*(-v00)/(v01-v00)});if(edges.length>=2){c.moveTo(toSx(edges[0].x),toSy(edges[0].y));c.lineTo(toSx(edges[1].x),toSy(edges[1].y))}}
      c.stroke();c.setLineDash([])
    }
    drawNc(fx,'rgba(251,191,36,0.6)'); drawNc(fy,'rgba(244,114,182,0.6)')
  }

  const trajs = d.trajectories || []
  for (let ti=0;ti<trajs.length;ti++) {
    const pts = trajData?.[ti] || integrateBoth(fx,fy,trajs[ti].x,trajs[ti].y,d.dt||0.03,d.maxSteps||2000,d)
    if (pts.length<2) continue
    const col = TRAJ_COLORS[ti%TRAJ_COLORS.length]
    c.strokeStyle=col;c.lineWidth=1.8;c.globalAlpha=0.9;c.beginPath()
    c.moveTo(toSx(pts[0].x),toSy(pts[0].y))
    for(let pi=1;pi<pts.length;pi++) c.lineTo(toSx(pts[pi].x),toSy(pts[pi].y))
    c.stroke();c.globalAlpha=1
    c.fillStyle=col;c.beginPath();c.arc(toSx(trajs[ti].x),toSy(trajs[ti].y),4,0,2*Math.PI);c.fill()
    c.strokeStyle='#fff';c.lineWidth=1;c.beginPath();c.arc(toSx(trajs[ti].x),toSy(trajs[ti].y),4,0,2*Math.PI);c.stroke()
  }

  if (d.showFixedPoints) {
    const fps = findFixedPoints(fx,fy,d.xMin,d.xMax,d.yMin,d.yMax)
    for (const fp of fps) {
      const fpColor = fp.type==='saddle'?'#ef4444':fp.type==='stable-node'||fp.type==='stable-spiral'?'#22c55e':fp.type==='center'?'#60a5fa':'#f59e0b'
      c.fillStyle=fpColor;c.globalAlpha=0.8;c.beginPath();c.arc(toSx(fp.x),toSy(fp.y),5,0,2*Math.PI);c.fill()
      if (fp.type==='saddle'||fp.type.startsWith('unstable')) { c.strokeStyle='#fff';c.lineWidth=1.5;c.beginPath();c.arc(toSx(fp.x),toSy(fp.y),5,0,2*Math.PI);c.stroke() }
      c.globalAlpha=1
    }
  }
  c.restore()
  c.fillStyle='rgba(255,255,255,0.35)';c.font='12px -apple-system,sans-serif';c.textAlign='center';c.textBaseline='bottom';c.fillText('x',W/2,H-1)
  c.save();c.translate(14,H/2);c.rotate(-Math.PI/2);c.textBaseline='top';c.fillText('y',0,0);c.restore()
}

// ---- Time series renderer ----
function drawTimeSeries(canvas, d) {
  const c = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const cw = canvas.clientWidth, ch = canvas.clientHeight
  canvas.width = cw * dpr; canvas.height = ch * dpr
  c.setTransform(dpr,0,0,dpr,0,0)

  const fx = compileExpr(d.dxdt), fy = compileExpr(d.dydt), fz = d.dzdt ? compileExpr(d.dzdt) : null
  const is3D = !!fz
  const tMax = d.tMax || 30, dt = d.dt || 0.03
  const steps = Math.min(Math.ceil(tMax / dt), 50000)
  const trajs = d.trajectories || []
  const pad = { l: 40, r: 16, t: 12, b: 28 }
  const W = cw - pad.l - pad.r, H = ch - pad.t - pad.b

  c.fillStyle = d.bgColor || '#0f0f1a'; c.fillRect(0, 0, cw, ch)

  const allPts = is3D
    ? trajs.map(tr => integrateForward3D(fx, fy, fz, tr.x, tr.y, tr.z || 0, dt, steps))
    : trajs.map(tr => integrateForward(fx, fy, tr.x, tr.y, dt, steps, null))

  let vMin = Infinity, vMax = -Infinity
  for (const pts of allPts) for (const p of pts) {
    if (p.x < vMin) vMin = p.x; if (p.x > vMax) vMax = p.x
    if (p.y < vMin) vMin = p.y; if (p.y > vMax) vMax = p.y
    if (is3D && p.z != null) { if (p.z < vMin) vMin = p.z; if (p.z > vMax) vMax = p.z }
  }
  if (!isFinite(vMin)) { vMin = -1; vMax = 1 }
  const vPad = (vMax - vMin) * 0.08 || 1; vMin -= vPad; vMax += vPad

  const toSx = t => pad.l + (t / tMax) * W
  const toSy = v => pad.t + (1 - (v - vMin) / (vMax - vMin)) * H

  c.save(); c.beginPath(); c.rect(pad.l, pad.t, W, H); c.clip()

  const tStep = niceStep(tMax), vStep = niceStep(vMax - vMin)
  c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 0.5
  c.font = '10px -apple-system,sans-serif'; c.fillStyle = 'rgba(255,255,255,0.25)'
  c.textAlign = 'center'; c.textBaseline = 'top'
  for (let gt = 0; gt <= tMax; gt += tStep) { const sx = toSx(gt); c.beginPath(); c.moveTo(sx, pad.t); c.lineTo(sx, pad.t + H); c.stroke(); c.fillText(fmt(gt), sx, pad.t + H + 2) }
  c.textAlign = 'right'; c.textBaseline = 'middle'
  for (let gv = Math.ceil(vMin / vStep) * vStep; gv <= vMax; gv += vStep) { const sy = toSy(gv); c.beginPath(); c.moveTo(pad.l, sy); c.lineTo(pad.l + W, sy); c.stroke(); c.fillText(fmt(gv), pad.l - 4, sy) }
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1
  if (vMin <= 0 && vMax >= 0) { const zy = toSy(0); c.beginPath(); c.moveTo(pad.l, zy); c.lineTo(pad.l + W, zy); c.stroke() }

  for (let ti = 0; ti < allPts.length; ti++) {
    const pts = allPts[ti], col = TRAJ_COLORS[ti % TRAJ_COLORS.length]
    if (pts.length < 2) continue
    c.strokeStyle = col; c.lineWidth = 1.8; c.globalAlpha = 0.9; c.setLineDash([])
    c.beginPath(); c.moveTo(toSx(pts[0].t), toSy(pts[0].x))
    for (let i = 1; i < pts.length; i++) c.lineTo(toSx(pts[i].t), toSy(pts[i].x))
    c.stroke()
    c.setLineDash([5, 3])
    c.beginPath(); c.moveTo(toSx(pts[0].t), toSy(pts[0].y))
    for (let i = 1; i < pts.length; i++) c.lineTo(toSx(pts[i].t), toSy(pts[i].y))
    c.stroke()
    if (is3D) {
      c.setLineDash([2, 2])
      c.beginPath(); c.moveTo(toSx(pts[0].t), toSy(pts[0].z))
      for (let i = 1; i < pts.length; i++) c.lineTo(toSx(pts[i].t), toSy(pts[i].z))
      c.stroke()
    }
    c.setLineDash([]); c.globalAlpha = 1
  }
  c.restore()

  c.fillStyle = 'rgba(255,255,255,0.35)'; c.font = '12px -apple-system,sans-serif'
  c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText('t', pad.l + W / 2, ch - 1)
  c.save(); c.translate(10, pad.t + H / 2); c.rotate(-Math.PI / 2); c.textBaseline = 'top'; c.fillText('value', 0, 0); c.restore()

  if (trajs.length > 0) {
    const legendH = is3D ? 42 : 28
    c.font = '10px -apple-system,sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'
    const lx = pad.l + 8, ly = pad.t + 10
    c.fillStyle = 'rgba(15,15,26,0.7)'; c.fillRect(lx - 4, ly - 8, 80, legendH)
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.5; c.setLineDash([])
    c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + 16, ly); c.stroke(); c.fillText('x(t)', lx + 20, ly)
    c.setLineDash([5, 3]); c.beginPath(); c.moveTo(lx, ly + 14); c.lineTo(lx + 16, ly + 14); c.stroke(); c.fillText('y(t)', lx + 20, ly + 14)
    if (is3D) { c.setLineDash([2, 2]); c.beginPath(); c.moveTo(lx, ly + 28); c.lineTo(lx + 16, ly + 28); c.stroke(); c.fillText('z(t)', lx + 20, ly + 28) }
    c.setLineDash([])
  }
}

// ---- 3D Attractor renderer ----
function draw3D(canvas, d, rotX, rotY) {
  const c = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const cw = canvas.clientWidth, ch = canvas.clientHeight
  canvas.width = cw * dpr; canvas.height = ch * dpr
  c.setTransform(dpr,0,0,dpr,0,0)

  const fx = compileExpr(d.dxdt), fy = compileExpr(d.dydt), fz = compileExpr(d.dzdt || '0')
  const trajs = d.trajectories || []
  const dt = d.dt || 0.005, steps = d.maxSteps || 12000
  const cx = cw / 2, cy = ch / 2

  c.fillStyle = d.bgColor || '#0f0f1a'; c.fillRect(0, 0, cw, ch)

  const allPts = trajs.map(tr => integrateForward3D(fx, fy, fz, tr.x, tr.y, tr.z || 0, dt, steps))

  let rMax = 1
  for (const pts of allPts) for (const p of pts) {
    const r = Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z || 0))
    if (r > rMax && isFinite(r)) rMax = r
  }
  const scale = Math.min(cw, ch) * 0.38 / rMax

  const cosX = Math.cos(rotX), sinX = Math.sin(rotX), cosY = Math.cos(rotY), sinY = Math.sin(rotY)
  function project(px, py, pz) {
    const x1 = px * cosY + pz * sinY, z1 = -px * sinY + pz * cosY
    const y1 = py * cosX - z1 * sinX
    return { sx: cx + x1 * scale, sy: cy - y1 * scale, depth: py * sinX + z1 * cosX }
  }

  // Axis frame
  const axLen = rMax * 0.6
  const axes = [
    { label: 'x', color: '#ef4444', end: [axLen, 0, 0] },
    { label: 'y', color: '#22c55e', end: [0, axLen, 0] },
    { label: 'z', color: '#60a5fa', end: [0, 0, axLen] },
  ]
  c.globalAlpha = 0.35; c.lineWidth = 1
  for (const ax of axes) {
    const o = project(0, 0, 0), e = project(...ax.end)
    c.strokeStyle = ax.color; c.beginPath(); c.moveTo(o.sx, o.sy); c.lineTo(e.sx, e.sy); c.stroke()
    c.fillStyle = ax.color; c.font = '11px -apple-system,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(ax.label, e.sx + (e.sx - o.sx) * 0.15, e.sy + (e.sy - o.sy) * 0.15)
  }
  c.globalAlpha = 1

  // Trajectories
  for (let ti = 0; ti < allPts.length; ti++) {
    const pts = allPts[ti], col = TRAJ_COLORS[ti % TRAJ_COLORS.length]
    if (pts.length < 2) continue
    const projected = pts.map(p => project(p.x, p.y, p.z || 0))
    c.strokeStyle = col; c.lineWidth = 1.2
    for (let i = 1; i < projected.length; i++) {
      const alpha = 0.15 + 0.75 * (i / projected.length)
      c.globalAlpha = alpha
      c.beginPath(); c.moveTo(projected[i - 1].sx, projected[i - 1].sy); c.lineTo(projected[i].sx, projected[i].sy); c.stroke()
    }
    c.globalAlpha = 1
    const start = projected[0]
    c.fillStyle = col; c.beginPath(); c.arc(start.sx, start.sy, 3, 0, 2 * Math.PI); c.fill()
  }
}

export default function DynSysEditor({ initialData, onApply, onCancel }) {
  const [d, setD] = useState(() => ({ viewMode: 'phase', ...initialData }))
  const phaseRef = useRef(null)
  const tsRef = useRef(null)
  const threeDRef = useRef(null)
  const rafRef = useRef(null)
  const [rot, setRot] = useState({ x: initialData.rotX ?? -0.5, y: initialData.rotY ?? 0.6 })
  const dragRef = useRef(null)

  const is3D = !!(d.dzdt && d.dzdt.trim())
  const upd = useCallback((patch) => setD(prev => ({ ...prev, ...patch })), [])

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (phaseRef.current) drawPhase(phaseRef.current, d)
      if (tsRef.current) drawTimeSeries(tsRef.current, d)
      if (threeDRef.current && is3D) draw3D(threeDRef.current, d, rot.x, rot.y)
    })
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [d, rot, is3D])

  function handlePhaseClick(e) {
    const rect = phaseRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const W = rect.width, H = rect.height
    const wx = d.xMin + mx / W * (d.xMax - d.xMin)
    const wy = d.yMin + (1 - my / H) * (d.yMax - d.yMin)
    if (wx < d.xMin || wx > d.xMax || wy < d.yMin || wy > d.yMax) return
    const trajs = [...(d.trajectories || [])]
    if (e.shiftKey) {
      const toSx = x => (x - d.xMin) / (d.xMax - d.xMin) * W
      const toSy = y => (1 - (y - d.yMin) / (d.yMax - d.yMin)) * H
      let best = -1, bestD = Infinity
      for (let i = 0; i < trajs.length; i++) { const dd = (toSx(trajs[i].x) - mx) ** 2 + (toSy(trajs[i].y) - my) ** 2; if (dd < bestD) { bestD = dd; best = i } }
      if (best >= 0 && bestD < 400) trajs.splice(best, 1)
    } else {
      trajs.push({ x: Math.round(wx * 100) / 100, y: Math.round(wy * 100) / 100 })
    }
    upd({ trajectories: trajs })
  }

  function handle3DMouseDown(e) { dragRef.current = { startX: e.clientX, startY: e.clientY, startRotX: rot.x, startRotY: rot.y } }
  function handle3DMouseMove(e) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX, dy = e.clientY - dragRef.current.startY
    setRot({ x: dragRef.current.startRotX + dy * 0.005, y: dragRef.current.startRotY + dx * 0.005 })
  }
  function handle3DMouseUp() { dragRef.current = null }

  const monoFont = "'SF Mono','Fira Code',monospace"
  const inputStyle = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#e0e0f0', padding: '4px 8px', borderRadius: 4, fontSize: 12, fontFamily: monoFont, outline: 'none', width: 160 }
  const labelStyle = { fontSize: 11, color: '#8888a0', marginRight: 4 }
  const btnStyle = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#c0c0d0', padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }
  const activeBtnStyle = { ...btnStyle, background: 'rgba(99,102,241,0.3)', borderColor: '#6366f1', color: '#a5b4fc' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onKeyDown={e => { if (e.key === 'Escape') onCancel() }}>
      <div style={{ background: 'var(--bg-card, #1e1e2e)', border: '1px solid var(--border, #333)', borderRadius: 12, width: '92vw', maxWidth: 1400, height: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border, #333)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary, #fff)', marginRight: 8 }}>Dynamical System</span>
          <span style={labelStyle}>dx/dt =</span>
          <input style={inputStyle} value={d.dxdt || ''} onChange={e => upd({ dxdt: e.target.value })} spellCheck="false" />
          <span style={labelStyle}>dy/dt =</span>
          <input style={inputStyle} value={d.dydt || ''} onChange={e => upd({ dydt: e.target.value })} spellCheck="false" />
          <span style={labelStyle}>dz/dt =</span>
          <input style={{ ...inputStyle, width: 140 }} value={d.dzdt || ''} onChange={e => upd({ dzdt: e.target.value })} spellCheck="false" placeholder="(empty = 2D)" />
          <select style={{ ...btnStyle, padding: '4px 6px' }} value="" onChange={e => { const p = ALL_PRESETS[e.target.value]; if (p) upd(p) }}>
            <option value="">Preset...</option>
            <optgroup label="2D Systems">
              <option value="pendulum">Damped Pendulum</option>
              <option value="vanderpol">Van der Pol</option>
              <option value="lotka">Lotka-Volterra</option>
              <option value="saddle">Linear Saddle</option>
              <option value="spiral">Stable Spiral</option>
              <option value="center">Center</option>
              <option value="duffing">Duffing</option>
            </optgroup>
            <optgroup label="3D Attractors">
              <option value="lorenz">Lorenz</option>
              <option value="rossler">R&ouml;ssler</option>
              <option value="chen">Chen</option>
              <option value="thomas">Thomas</option>
              <option value="aizawa">Aizawa</option>
            </optgroup>
          </select>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />
          <button style={d.showField !== false ? activeBtnStyle : btnStyle} onClick={() => upd({ showField: d.showField === false })}>Field</button>
          <button style={d.showNullclines ? activeBtnStyle : btnStyle} onClick={() => upd({ showNullclines: !d.showNullclines })}>Nullclines</button>
          <button style={d.showFixedPoints ? activeBtnStyle : btnStyle} onClick={() => upd({ showFixedPoints: !d.showFixedPoints })}>Fixed Pts</button>
          <button style={btnStyle} onClick={() => upd({ trajectories: [] })}>Clear</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onCancel}>Cancel</button>
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => onApply({ ...d, rotX: rot.x, rotY: rot.y })}>Apply</button>
          </div>
        </div>

        {/* Body: panes */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }} onMouseMove={handle3DMouseMove} onMouseUp={handle3DMouseUp} onMouseLeave={handle3DMouseUp}>
          {/* Phase portrait */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border, #333)', outline: d.viewMode === 'phase' ? '2px solid #6366f1' : 'none', outlineOffset: -2 }}>
            <div onClick={() => upd({ viewMode: 'phase' })} style={{ padding: '6px 12px', fontSize: 11, color: d.viewMode === 'phase' ? '#a5b4fc' : '#8888a0', borderBottom: '1px solid var(--border, #333)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: d.viewMode === 'phase' ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {d.viewMode === 'phase' && <span style={{ width: 6, height: 6, borderRadius: 3, background: '#6366f1', flexShrink: 0 }} />}
                Phase Portrait
              </span>
              <span style={{ fontFamily: monoFont, fontSize: 10 }}>click to add</span>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas ref={phaseRef} onClick={handlePhaseClick} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'crosshair' }} />
            </div>
          </div>

          {/* 3D Attractor (only when dzdt is set) */}
          {is3D && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border, #333)', outline: d.viewMode === '3d' ? '2px solid #6366f1' : 'none', outlineOffset: -2 }}>
              <div onClick={() => upd({ viewMode: '3d' })} style={{ padding: '6px 12px', fontSize: 11, color: d.viewMode === '3d' ? '#a5b4fc' : '#8888a0', borderBottom: '1px solid var(--border, #333)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: d.viewMode === '3d' ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {d.viewMode === '3d' && <span style={{ width: 6, height: 6, borderRadius: 3, background: '#6366f1', flexShrink: 0 }} />}
                  3D Attractor
                </span>
                <span style={{ fontFamily: monoFont, fontSize: 10 }}>drag to rotate</span>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <canvas ref={threeDRef} onMouseDown={handle3DMouseDown} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: dragRef.current ? 'grabbing' : 'grab' }} />
              </div>
            </div>
          )}

          {/* Time series */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', outline: d.viewMode === 'timeseries' ? '2px solid #6366f1' : 'none', outlineOffset: -2 }}>
            <div onClick={() => upd({ viewMode: 'timeseries' })} style={{ padding: '6px 12px', fontSize: 11, color: d.viewMode === 'timeseries' ? '#a5b4fc' : '#8888a0', borderBottom: '1px solid var(--border, #333)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: d.viewMode === 'timeseries' ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {d.viewMode === 'timeseries' && <span style={{ width: 6, height: 6, borderRadius: 3, background: '#6366f1', flexShrink: 0 }} />}
                Time Series
              </span>
              <span style={{ fontFamily: monoFont, fontSize: 10 }}>{(d.trajectories||[]).length} trajectories</span>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas ref={tsRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            </div>
          </div>
        </div>

        {/* Footer controls */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border, #333)', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, fontSize: 11, color: '#8888a0' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            x min <input type="number" step="1" value={d.xMin ?? -8} onChange={e => upd({ xMin: Number(e.target.value) })} style={{ ...inputStyle, width: 56, fontSize: 11 }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            x max <input type="number" step="1" value={d.xMax ?? 8} onChange={e => upd({ xMax: Number(e.target.value) })} style={{ ...inputStyle, width: 56, fontSize: 11 }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            y min <input type="number" step="1" value={d.yMin ?? -5} onChange={e => upd({ yMin: Number(e.target.value) })} style={{ ...inputStyle, width: 56, fontSize: 11 }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            y max <input type="number" step="1" value={d.yMax ?? 5} onChange={e => upd({ yMax: Number(e.target.value) })} style={{ ...inputStyle, width: 56, fontSize: 11 }} />
          </label>
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Density <input type="range" min="8" max="30" value={d.gridDensity || 18} onChange={e => upd({ gridDensity: Number(e.target.value) })} style={{ width: 80, accentColor: '#6366f1' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            t max <input type="range" min="5" max="100" value={d.tMax || 30} onChange={e => upd({ tMax: Number(e.target.value) })} style={{ width: 80, accentColor: '#6366f1' }} />
            <span style={{ fontFamily: monoFont, fontSize: 10, minWidth: 24 }}>{d.tMax || 30}</span>
          </label>
          <div style={{ marginLeft: 'auto', fontSize: 10, color: '#8888a0', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: '#6366f1' }} />
            Slide shows: {d.viewMode === '3d' ? '3D Attractor' : d.viewMode === 'timeseries' ? 'Time Series' : 'Phase Portrait'}
            <span style={{ color: '#666', marginLeft: 4 }}>(click pane header to change)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
