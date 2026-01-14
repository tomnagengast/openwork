const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const binDir = path.join(__dirname, 'bin')
const tarPath = path.join(binDir, 'openwork.tar.gz')
const appPath = path.join(binDir, 'openwork.app')
const binaryPath = path.join(appPath, 'Contents', 'MacOS', 'openwork')

// Extract tar.gz on first run (preserves symlinks that npm would resolve)
if (!fs.existsSync(appPath) && fs.existsSync(tarPath)) {
  execSync(`tar -xzf "${tarPath}" -C "${binDir}"`, { stdio: 'inherit' })
}

module.exports = binaryPath
