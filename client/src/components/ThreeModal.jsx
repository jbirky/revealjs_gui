// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useMemo } from 'react'

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js'
const ORBIT_CDN = 'https://cdn.jsdelivr.net/npm/three@0.162.0/examples/jsm/controls/OrbitControls.js'

const TEMPLATES = [
  { id: 'rotating-cube', name: 'Rotating Cube', desc: 'Simple colored cube with orbit controls' },
  { id: 'wireframe-sphere', name: 'Wireframe Sphere', desc: 'Icosahedron wireframe with glow effect' },
  { id: 'particle-cloud', name: 'Particle Cloud', desc: 'Thousands of floating particles' },
  { id: 'torus-knot', name: 'Torus Knot', desc: 'Shiny torus knot with reflections' },
  { id: 'wave-plane', name: 'Wave Plane', desc: 'Animated sine wave deforming a plane mesh' },
  { id: 'galaxy', name: 'Galaxy', desc: 'Spiral galaxy of star particles' },
  { id: 'terrain', name: 'Terrain', desc: 'Procedural terrain with height-based coloring' },
  { id: 'instanced-spheres', name: 'Instanced Spheres', desc: 'Grid of spheres with wave animation' },
  { id: 'custom', name: 'Custom Code', desc: 'Write your own Three.js scene' },
]

function generateHTML(templateId, params) {
  const { color, bg, speed } = params
  const col = color || '#6366f1'
  const background = bg || '#0a0a14'
  const spd = speed || 1

  const base = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:${background}}canvas{display:block}</style>
</head><body>
<script type="importmap">{"imports":{"three":"${THREE_CDN}","three/addons/controls/OrbitControls.js":"${ORBIT_CDN}"}}</script>
<script type="module">`

  const end = `<\/script></body></html>`

  const setupCamera = `const W=window.innerWidth,H=window.innerHeight;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(60,W/H,0.1,1000);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:${background === 'transparent'}});
renderer.setSize(W,H);renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
${background !== 'transparent' ? `scene.background=new THREE.Color('${background}');` : ''}
document.body.appendChild(renderer.domElement);`

  const orbit = `import{OrbitControls}from'three/addons/controls/OrbitControls.js';
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=0.05;`

  const resize = `window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight)});`

  switch (templateId) {

    case 'rotating-cube':
      return `${base}
import*as THREE from'three';
${setupCamera}
${orbit}
camera.position.set(2,2,3);
const geo=new THREE.BoxGeometry(1.5,1.5,1.5);
const mat=new THREE.MeshStandardMaterial({color:'${col}',metalness:0.3,roughness:0.4});
const cube=new THREE.Mesh(geo,mat);scene.add(cube);
scene.add(new THREE.AmbientLight(0xffffff,0.5));
const dl=new THREE.DirectionalLight(0xffffff,1);dl.position.set(3,4,5);scene.add(dl);
const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.15}));
cube.add(edges);
${resize}
function animate(){requestAnimationFrame(animate);cube.rotation.x+=0.005*${spd};cube.rotation.y+=0.008*${spd};controls.update();renderer.render(scene,camera)}animate();
${end}`

    case 'wireframe-sphere':
      return `${base}
import*as THREE from'three';
${setupCamera}
${orbit}
camera.position.set(0,0,4);
const geo=new THREE.IcosahedronGeometry(1.5,2);
const wire=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:'${col}',wireframe:true,transparent:true,opacity:0.6}));
scene.add(wire);
const inner=new THREE.Mesh(new THREE.IcosahedronGeometry(1.48,2),new THREE.MeshBasicMaterial({color:'${col}',transparent:true,opacity:0.05}));
scene.add(inner);
${resize}
function animate(){requestAnimationFrame(animate);wire.rotation.x+=0.003*${spd};wire.rotation.y+=0.005*${spd};controls.update();renderer.render(scene,camera)}animate();
${end}`

    case 'particle-cloud':
      return `${base}
import*as THREE from'three';
${setupCamera}
${orbit}
camera.position.set(0,0,5);
const N=2000,pos=new Float32Array(N*3),cols=new Float32Array(N*3);
const c1=new THREE.Color('${col}'),c2=new THREE.Color('#ffffff');
for(let i=0;i<N;i++){pos[i*3]=(Math.random()-0.5)*8;pos[i*3+1]=(Math.random()-0.5)*8;pos[i*3+2]=(Math.random()-0.5)*8;
const t=Math.random();const c=c1.clone().lerp(c2,t);cols[i*3]=c.r;cols[i*3+1]=c.g;cols[i*3+2]=c.b}
const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(cols,3));
const mat=new THREE.PointsMaterial({size:0.04,vertexColors:true,transparent:true,opacity:0.8});
const pts=new THREE.Points(geo,mat);scene.add(pts);
${resize}
function animate(){requestAnimationFrame(animate);pts.rotation.y+=0.001*${spd};pts.rotation.x+=0.0005*${spd};controls.update();renderer.render(scene,camera)}animate();
${end}`

    case 'torus-knot':
      return `${base}
import*as THREE from'three';
${setupCamera}
${orbit}
camera.position.set(0,0,5);
const geo=new THREE.TorusKnotGeometry(1.2,0.4,128,32);
const mat=new THREE.MeshStandardMaterial({color:'${col}',metalness:0.7,roughness:0.2});
const mesh=new THREE.Mesh(geo,mat);scene.add(mesh);
scene.add(new THREE.AmbientLight(0xffffff,0.4));
const dl=new THREE.DirectionalLight(0xffffff,1);dl.position.set(5,5,5);scene.add(dl);
const pl=new THREE.PointLight(0xff6600,0.5,10);pl.position.set(-3,2,2);scene.add(pl);
${resize}
function animate(){requestAnimationFrame(animate);mesh.rotation.x+=0.004*${spd};mesh.rotation.y+=0.006*${spd};controls.update();renderer.render(scene,camera)}animate();
${end}`

    case 'wave-plane':
      return `${base}
import*as THREE from'three';
${setupCamera}
${orbit}
camera.position.set(0,3,5);camera.lookAt(0,0,0);
const geo=new THREE.PlaneGeometry(8,8,80,80);geo.rotateX(-Math.PI/2);
const mat=new THREE.MeshStandardMaterial({color:'${col}',wireframe:true,transparent:true,opacity:0.6});
const mesh=new THREE.Mesh(geo,mat);scene.add(mesh);
scene.add(new THREE.AmbientLight(0xffffff,0.5));
const dl=new THREE.DirectionalLight(0xffffff,0.8);dl.position.set(3,5,3);scene.add(dl);
const posAttr=geo.getAttribute('position');const initY=new Float32Array(posAttr.count);
for(let i=0;i<posAttr.count;i++)initY[i]=posAttr.getY(i);
${resize}
let t=0;function animate(){requestAnimationFrame(animate);t+=0.02*${spd};
for(let i=0;i<posAttr.count;i++){const x=posAttr.getX(i),z=posAttr.getZ(i);posAttr.setY(i,Math.sin(x*1.5+t)*0.3+Math.cos(z*1.5+t*0.7)*0.3)}
posAttr.needsUpdate=true;geo.computeVertexNormals();controls.update();renderer.render(scene,camera)}animate();
${end}`

    case 'galaxy':
      return `${base}
import*as THREE from'three';
${setupCamera}
${orbit}
camera.position.set(0,4,6);camera.lookAt(0,0,0);
const N=5000,pos=new Float32Array(N*3),cols=new Float32Array(N*3);
const c1=new THREE.Color('${col}'),c2=new THREE.Color('#ffffff'),c3=new THREE.Color('#ff6b6b');
for(let i=0;i<N;i++){const r=Math.random()*4,a=r*2.5+Math.random()*0.8,h=(Math.random()-0.5)*0.3*Math.max(0,1-r/4);
pos[i*3]=Math.cos(a)*r+(Math.random()-0.5)*0.3;pos[i*3+1]=h;pos[i*3+2]=Math.sin(a)*r+(Math.random()-0.5)*0.3;
const t=r/4;const c=t<0.5?c1.clone().lerp(c2,t*2):c2.clone().lerp(c3,(t-0.5)*2);cols[i*3]=c.r;cols[i*3+1]=c.g;cols[i*3+2]=c.b}
const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(cols,3));
const pts=new THREE.Points(geo,new THREE.PointsMaterial({size:0.03,vertexColors:true,transparent:true,opacity:0.9}));
scene.add(pts);
const core=new THREE.Mesh(new THREE.SphereGeometry(0.15,16,16),new THREE.MeshBasicMaterial({color:0xffffff}));scene.add(core);
${resize}
function animate(){requestAnimationFrame(animate);pts.rotation.y+=0.002*${spd};controls.update();renderer.render(scene,camera)}animate();
${end}`

    case 'terrain':
      return `${base}
import*as THREE from'three';
${setupCamera}
${orbit}
camera.position.set(4,3,4);camera.lookAt(0,0,0);
const S=80,geo=new THREE.PlaneGeometry(8,8,S,S);geo.rotateX(-Math.PI/2);
const pos=geo.getAttribute('position');
for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);
pos.setY(i,Math.sin(x*0.8)*Math.cos(z*0.8)*0.8+Math.sin(x*1.5+1)*0.3+Math.cos(z*2)*0.2)}
geo.computeVertexNormals();
const cols=new Float32Array(pos.count*3);const lo=new THREE.Color('#1a5276'),hi=new THREE.Color('${col}'),peak=new THREE.Color('#ffffff');
for(let i=0;i<pos.count;i++){const h=(pos.getY(i)+1.3)/2.6;const c=h<0.5?lo.clone().lerp(hi,h*2):hi.clone().lerp(peak,(h-0.5)*2);cols[i*3]=c.r;cols[i*3+1]=c.g;cols[i*3+2]=c.b}
geo.setAttribute('color',new THREE.BufferAttribute(cols,3));
const mat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true});
scene.add(new THREE.Mesh(geo,mat));
scene.add(new THREE.AmbientLight(0xffffff,0.4));
const dl=new THREE.DirectionalLight(0xffffff,0.8);dl.position.set(5,8,3);scene.add(dl);
${resize}
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}animate();
${end}`

    case 'instanced-spheres':
      return `${base}
import*as THREE from'three';
${setupCamera}
${orbit}
camera.position.set(5,5,7);camera.lookAt(0,0,0);
const G=8,geo=new THREE.SphereGeometry(0.3,16,16),mat=new THREE.MeshStandardMaterial({color:'${col}',metalness:0.5,roughness:0.3});
const mesh=new THREE.InstancedMesh(geo,mat,G*G);
const dummy=new THREE.Object3D();let idx=0;
for(let x=0;x<G;x++)for(let z=0;z<G;z++){dummy.position.set(x-G/2+0.5,0,z-G/2+0.5);dummy.updateMatrix();mesh.setMatrixAt(idx++,dummy.matrix)}
mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);
scene.add(new THREE.AmbientLight(0xffffff,0.5));
const dl=new THREE.DirectionalLight(0xffffff,0.8);dl.position.set(5,8,5);scene.add(dl);
${resize}
let t=0;function animate(){requestAnimationFrame(animate);t+=0.03*${spd};idx=0;
for(let x=0;x<G;x++)for(let z=0;z<G;z++){dummy.position.set(x-G/2+0.5,Math.sin(x*0.8+t)*Math.cos(z*0.8+t)*0.8,z-G/2+0.5);
dummy.scale.setScalar(0.7+Math.sin(x+z+t*2)*0.3);dummy.updateMatrix();mesh.setMatrixAt(idx++,dummy.matrix)}
mesh.instanceMatrix.needsUpdate=true;controls.update();renderer.render(scene,camera)}animate();
${end}`

    default:
      return `${base}
import*as THREE from'three';
${setupCamera}
camera.position.set(0,0,3);
const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({color:'${col}',wireframe:true}));
scene.add(mesh);
function animate(){requestAnimationFrame(animate);mesh.rotation.x+=0.01;mesh.rotation.y+=0.01;renderer.render(scene,camera)}animate();
${end}`
  }
}

const DEFAULT_CUSTOM = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:#0a0a14}canvas{display:block}</style>
</head><body>
<script type="importmap">{"imports":{"three":"${THREE_CDN}","three/addons/controls/OrbitControls.js":"${ORBIT_CDN}"}}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0a14');
const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 1000);
camera.position.set(2, 2, 3);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Add lights
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(3, 4, 5);
scene.add(light);

// Add a mesh
const geometry = new THREE.TorusGeometry(1, 0.4, 32, 64);
const material = new THREE.MeshStandardMaterial({
  color: '#6366f1',
  metalness: 0.5,
  roughness: 0.3,
});
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

// Animate
function animate() {
  requestAnimationFrame(animate);
  mesh.rotation.x += 0.005;
  mesh.rotation.y += 0.008;
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
<\/script>
</body></html>`

export default function ThreeModal({ onInsert, onClose, slideW, slideH }) {
  const [selected, setSelected] = useState('rotating-cube')
  const [params, setParams] = useState({ color: '#6366f1', bg: '#0a0a14', speed: 1 })
  const [customCode, setCustomCode] = useState(DEFAULT_CUSTOM)
  const [customPreviewKey, setCustomPreviewKey] = useState(0)

  const update = (k, v) => setParams(p => ({ ...p, [k]: v }))
  const isCustom = selected === 'custom'

  const previewHtml = useMemo(() => isCustom ? customCode : generateHTML(selected, params),
    [selected, params, isCustom, customCode, customPreviewKey])
  const previewKey = isCustom ? `custom-${customPreviewKey}` : `${selected}-${JSON.stringify(params)}`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--bg-card, #1e1e2e)', borderRadius: 12, width: 900, maxHeight: '92vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border, #333)', overflow: 'hidden' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border, #333)' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary, #fff)' }}>Three.js Scene</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted, #888)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>&times;</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: template grid */}
          <div style={{ width: 220, borderRight: '1px solid var(--border, #333)', overflowY: 'auto', padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setSelected(t.id)} title={t.desc}
                  style={{
                    padding: '10px 6px', borderRadius: 6,
                    border: selected === t.id ? '2px solid var(--accent, #6366f1)' : '1px solid var(--border, #333)',
                    background: selected === t.id ? 'rgba(99,102,241,0.12)' : 'var(--bg-hover, #252530)',
                    color: 'var(--text-primary, #fff)', cursor: 'pointer', fontSize: 10, fontWeight: 600, textAlign: 'center', lineHeight: 1.3,
                  }}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Right */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: 12, flex: isCustom ? 'none' : 1, minHeight: isCustom ? 220 : 280, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a14' }}>
              <iframe
                key={previewKey}
                srcDoc={previewHtml}
                style={{ width: (slideW || 960) * 0.58, height: (slideH || 540) * 0.58, border: '1px solid #333', borderRadius: 6, background: '#0a0a14' }}
                sandbox="allow-scripts"
                title="Three.js preview"
              />
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border, #333)', overflowY: 'auto', flex: isCustom ? 1 : undefined, maxHeight: isCustom ? undefined : 160 }}>
              {isCustom ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>Custom Three.js code (ES module imports)</div>
                    <button onClick={() => setCustomPreviewKey(k => k + 1)}
                      style={{ padding: '3px 10px', fontSize: 11, background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', borderRadius: 4, color: 'var(--text-primary, #fff)', cursor: 'pointer' }}>
                      Refresh Preview
                    </button>
                  </div>
                  <textarea
                    value={customCode}
                    onChange={e => setCustomCode(e.target.value)}
                    spellCheck={false}
                    style={{ flex: 1, minHeight: 200, width: '100%', padding: '8px 10px', background: '#0a0a14', border: '1px solid var(--border, #333)', borderRadius: 6, color: '#e2e8f0', fontSize: 12, fontFamily: "'Fira Code','JetBrains Mono',monospace", lineHeight: 1.5, resize: 'vertical', boxSizing: 'border-box', tabSize: 2 }}
                    onKeyDown={e => {
                      if (e.key === 'Tab') {
                        e.preventDefault()
                        const start = e.target.selectionStart, end = e.target.selectionEnd
                        setCustomCode(c => c.substring(0, start) + '  ' + c.substring(end))
                        setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = start + 2 }, 0)
                      }
                    }}
                  />
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted, #888)', marginBottom: 2 }}>Color</div>
                      <input type="color" value={params.color} onChange={e => update('color', e.target.value)}
                        style={{ width: '100%', height: 28, border: '1px solid var(--border, #333)', borderRadius: 4, cursor: 'pointer', background: 'var(--bg-hover)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted, #888)', marginBottom: 2 }}>Background</div>
                      <select value={params.bg} onChange={e => update('bg', e.target.value)}
                        style={{ width: '100%', padding: '5px 4px', background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', borderRadius: 4, color: 'var(--text-primary, #fff)', fontSize: 11 }}>
                        <option value="transparent">Transparent</option>
                        <option value="#0a0a14">Dark</option>
                        <option value="#1e1e2e">Slate</option>
                        <option value="#000000">Black</option>
                        <option value="#111827">Navy</option>
                        <option value="#ffffff">White</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted, #888)', marginBottom: 2 }}>Speed</div>
                      <input type="number" min={0.1} max={5} step={0.1} value={params.speed} onChange={e => update('speed', Number(e.target.value) || 1)}
                        style={{ width: '100%', padding: '5px 6px', background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', borderRadius: 4, color: 'var(--text-primary, #fff)', fontSize: 11 }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>
                      {TEMPLATES.find(t => t.id === selected)?.desc} — drag to orbit, scroll to zoom
                    </div>
                    <button onClick={() => { setCustomCode(generateHTML(selected, params)); setSelected('custom'); setCustomPreviewKey(k => k + 1) }}
                      style={{ padding: '3px 10px', fontSize: 10, background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', borderRadius: 4, color: 'var(--text-muted, #888)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary, #fff)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted, #888)'}
                      title="Copy this template to the custom editor">
                      Edit as code
                    </button>
                  </div>
                </>
              )}
            </div>

            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border, #333)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={onClose}
                style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border, #333)', background: 'transparent', color: 'var(--text-primary, #fff)', cursor: 'pointer', fontSize: 12 }}>
                Cancel
              </button>
              <button onClick={() => onInsert(isCustom ? customCode : previewHtml)}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--accent, #6366f1)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Insert
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
