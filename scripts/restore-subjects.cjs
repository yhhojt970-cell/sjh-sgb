#!/usr/bin/env node
// 백업 파일에서 가빈(sgb170101) 과목 목록을 Firestore에 복구합니다.
// 사용법: node scripts/restore-subjects.cjs [--apply]

const path = require('path')

const PROJECT_ID = 'sjh-sgb'
const HOUSEHOLD_ID = 'SJH-SGB'
const BACKUP_FILE = path.join(__dirname, '../backups/firestore-cleanup/2026-05-10T05-16-49-422Z_SJH-SGB.json')

const applyChanges = process.argv.includes('--apply')

function requireFirebaseTools(moduleName) {
  const candidates = [
    `firebase-tools/lib/${moduleName}`,
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools', 'lib', moduleName)
  ]
  for (const candidate of candidates) {
    try { return require(candidate) } catch {}
  }
  throw new Error(`Cannot load firebase-tools/lib/${moduleName}`)
}

const auth = requireFirebaseTools('auth')
const apiv2 = requireFirebaseTools('apiv2')

const account = auth.getGlobalDefaultAccount()
if (!account?.tokens?.refresh_token) throw new Error('firebase CLI 로그인 필요: firebase login')
apiv2.setRefreshToken(account.tokens.refresh_token)
const client = new apiv2.Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' })

const docPath = (segs) =>
  `/projects/${PROJECT_ID}/databases/(default)/documents/${segs.map(encodeURIComponent).join('/')}`

const resourceName = (segs) =>
  `projects/${PROJECT_ID}/databases/(default)/documents/${segs.join('/')}`

function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } }
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, encodeValue(val)])) } }
  return { stringValue: String(v) }
}

// 백업에서 가빈 과목 읽기
const backup = require(BACKUP_FILE)
const raw = backup.kids['sgb170101']?.data?.subjects || []

// 정리: kidId 제거, coins 기본값 1, 필드 정규화
const cleaned = raw.map((s) => {
  const obj = { name: s.name, color: s.color || '#8b5cf6', coins: typeof s.coins === 'number' ? s.coins : 1 }
  return obj
})

console.log(`\n복구할 과목 (sgb170101 / 손가빈) — ${cleaned.length}개:`)
cleaned.forEach((s, i) => console.log(`  ${i + 1}. ${s.name} | ${s.color} | ${s.coins}코인`))

if (!applyChanges) {
  console.log('\n[dry-run] 실제 적용하려면: node scripts/restore-subjects.cjs --apply')
  process.exit(0)
}

async function run() {
  const fields = { subjects: encodeValue(cleaned), updatedAt: encodeValue({ __firestoreTimestamp: new Date().toISOString() }) }

  const write = {
    update: { name: resourceName(['households', HOUSEHOLD_ID, 'kids', 'sgb170101']), fields },
    updateMask: { fieldPaths: ['subjects', 'updatedAt'] }
  }

  await client.post(`/projects/${PROJECT_ID}/databases/(default)/documents:commit`, { writes: [write] })
  console.log('\n✅ 복구 완료! — 앱을 새로고침하면 가빈 과목이 돌아옵니다.')
}

run().catch((e) => { console.error(e); process.exit(1) })
