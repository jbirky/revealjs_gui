// Install server dependencies into server/node_modules without touching root
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const serverDir = path.join(__dirname, '..', 'server')
const serverPkg = require(path.join(serverDir, 'package.json'))

// Create a temporary package.json without workspaces reference
const tmpPkg = {
  name: serverPkg.name,
  version: serverPkg.version,
  private: true,
  dependencies: serverPkg.dependencies,
}

const tmpPkgPath = path.join(serverDir, 'package.json.bak')
const origPkg = fs.readFileSync(path.join(serverDir, 'package.json'), 'utf8')

// Write temp package.json, install, restore
fs.writeFileSync(path.join(serverDir, 'package.json'), JSON.stringify(tmpPkg, null, 2))
try {
  execSync('npm install --omit=dev --ignore-scripts', { cwd: serverDir, stdio: 'inherit', env: { ...process.env, npm_config_workspace: '' } })
} finally {
  fs.writeFileSync(path.join(serverDir, 'package.json'), origPkg)
}

console.log('Server dependencies installed into server/node_modules/')
