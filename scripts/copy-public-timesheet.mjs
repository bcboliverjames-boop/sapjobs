import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const srcDir = path.join(projectRoot, 'public', 'timesheet')
const destDir = path.join(projectRoot, 'dist', 'build', 'h5', 'timesheet')

const existsDir = (p) => {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

const ensureDir = (p) => {
  fs.mkdirSync(p, { recursive: true })
}

const copyDir = (from, to) => {
  ensureDir(to)
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name)
    const dst = path.join(to, entry.name)
    if (entry.isDirectory()) {
      copyDir(src, dst)
      continue
    }
    if (entry.isSymbolicLink()) {
      try {
        const link = fs.readlinkSync(src)
        fs.symlinkSync(link, dst)
      } catch {
        // ignore
      }
      continue
    }
    fs.copyFileSync(src, dst)
  }
}

if (!existsDir(srcDir)) {
  console.log(`[copy-public-timesheet] skip: missing ${srcDir}`)
  process.exit(0)
}

try {
  copyDir(srcDir, destDir)
  console.log(`[copy-public-timesheet] copied to ${destDir}`)
} catch (e) {
  console.error('[copy-public-timesheet] failed:', e)
  process.exit(1)
}
