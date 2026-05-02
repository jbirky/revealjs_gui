// Copy server dependencies from root node_modules into server/node_modules
// so electron-builder packages them with the server
const fs = require('fs')
const path = require('path')

const rootModules = path.join(__dirname, '..', 'node_modules')
const serverDir = path.join(__dirname, '..', 'server')
const serverModules = path.join(serverDir, 'node_modules')
const serverPkg = require(path.join(serverDir, 'package.json'))

// Deps the server needs
const directDeps = Object.keys(serverPkg.dependencies || {})

// Recursively collect all sub-dependencies
function collectDeps(pkgName, collected = new Set()) {
  if (collected.has(pkgName)) return collected
  collected.add(pkgName)
  const pkgPath = path.join(rootModules, pkgName, 'package.json')
  if (!fs.existsSync(pkgPath)) return collected
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  for (const dep of Object.keys(pkg.dependencies || {})) {
    collectDeps(dep, collected)
  }
  return collected
}

const allDeps = new Set()
for (const dep of directDeps) {
  collectDeps(dep, allDeps)
}

// Clean and recreate server/node_modules
if (fs.existsSync(serverModules)) {
  fs.rmSync(serverModules, { recursive: true })
}
fs.mkdirSync(serverModules, { recursive: true })

// Copy each dependency
let count = 0
for (const dep of allDeps) {
  const src = path.join(rootModules, dep)
  const dest = path.join(serverModules, dep)
  if (fs.existsSync(src)) {
    copyDirSync(src, dest)
    count++
  }
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(srcPath)
      try { fs.symlinkSync(target, destPath) } catch { copyDirSync(fs.realpathSync(srcPath), destPath) }
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

console.log(`Copied ${count} packages into server/node_modules/`)
