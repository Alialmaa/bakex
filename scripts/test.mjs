#!/usr/bin/env node
/**
 * Runs the test suite.
 *
 * There is no real database here — .env.local is a stub — so the modules are
 * compiled to .test-build/ and the compiled stub is copied over
 * .test-build/lib/supabase.js. Everything under test then talks to the stub
 * without any of it knowing, and no mocking library is needed.
 *
 * Node's own test runner does the rest, so the project gains no dependencies.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const BUILD = '.test-build'

// The modules refuse to load without these. Values are irrelevant — nothing
// here reaches a network or a database.
const env = {
  ...process.env,
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-not-used-anywhere-real',
  APP_URL: 'https://test.bakexsystem.com',
  NEXT_PUBLIC_SUPABASE_URL: 'https://stub.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'stub-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'stub-service-role-key',
}

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32', ...opts })

rmSync(BUILD, { recursive: true, force: true })

const tsc = run('npx', ['tsc', '-p', 'tsconfig.test.json'])
if (tsc.status !== 0) {
  console.error('\ntest build failed — the suite cannot run until it compiles')
  process.exit(tsc.status ?? 1)
}

const stub = join(BUILD, 'tests', 'support', 'supabase-stub.js')
const target = join(BUILD, 'lib', 'supabase.js')
if (!existsSync(stub)) {
  console.error(`expected the compiled stub at ${stub}`)
  process.exit(1)
}
copyFileSync(stub, target)

const files = readdirSync(join(BUILD, 'tests'))
  .filter(f => f.endsWith('.test.js'))
  .map(f => join(BUILD, 'tests', f))

if (files.length === 0) {
  console.error('no test files found')
  process.exit(1)
}

const result = run('node', ['--test', ...files])
process.exit(result.status ?? 1)
