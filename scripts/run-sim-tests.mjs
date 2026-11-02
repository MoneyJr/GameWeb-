// Компилирует симуляцию и тесты в .sim-build (CommonJS) и запускает node:test.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
rmSync('.sim-build', { recursive: true, force: true })
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.sim-test.json'], { stdio: 'inherit' })
mkdirSync('.sim-build', { recursive: true })
writeFileSync('.sim-build/package.json', '{"type":"commonjs"}')
execFileSync(process.execPath, ['--test', '.sim-build/tests/simulation.test.js'], { stdio: 'inherit' })
