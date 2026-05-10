#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const DEFAULT_PROJECT_ID = 'sjh-sgb'
const DEFAULT_HOUSEHOLD_ID = 'SJH-SGB'

const DEFAULT_SUBJECT_NAMES = ['피아노', '영어', '수학', '국어', '독서']
const SUBJECT_COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#f97316', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

const PEOPLE = {
  yhhojt970: {
    canonicalKidDoc: null,
    aliases: ['엄마'],
    cleanName: '엄마',
    displayName: '엄마',
    role: 'admin'
  },
  sjh150717: {
    canonicalKidDoc: 'sjh150717',
    aliases: ['sjh150717', '손지희', '지희'],
    cleanName: '지희',
    displayName: '손지희',
    role: 'child'
  },
  sgb170101: {
    canonicalKidDoc: 'sgb170101',
    aliases: ['sgb170101', '손가빈', '가빈'],
    cleanName: '가빈',
    displayName: '손가빈',
    role: 'child'
  }
}

const LEGACY_KID_DOCS = ['손지희', '지희', '손가빈', '가빈', '엄마']

const ARRAY_FIELDS = [
  'tasks',
  'doneLogs',
  'allowanceEntries',
  'essentials',
  'rewards',
  'goals',
  'wishes'
]

const args = new Set(process.argv.slice(2))
const getArg = (name, fallback) => {
  const prefix = `--${name}=`
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : fallback
}

const projectId = getArg('project', DEFAULT_PROJECT_ID)
const householdId = getArg('household', DEFAULT_HOUSEHOLD_ID)
const applyChanges = args.has('--apply')
const deleteLegacy = args.has('--delete-legacy')
const inferSubjects = !args.has('--no-infer-subjects')

function requireFirebaseTools(moduleName) {
  const candidates = [
    `firebase-tools/lib/${moduleName}`,
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools', 'lib', moduleName)
  ]

  for (const candidate of candidates) {
    try {
      return require(candidate)
    } catch {
      // Try the next location.
    }
  }

  throw new Error(`Could not load firebase-tools/lib/${moduleName}. Install Firebase CLI or set APPDATA correctly.`)
}

const auth = requireFirebaseTools('auth')
const apiv2 = requireFirebaseTools('apiv2')

function initClient() {
  const account = auth.getGlobalDefaultAccount()
  if (!account?.tokens?.refresh_token) {
    throw new Error('Firebase CLI is not logged in. Run firebase.cmd login first.')
  }

  apiv2.setRefreshToken(account.tokens.refresh_token)
  return new apiv2.Client({
    urlPrefix: 'https://firestore.googleapis.com',
    apiVersion: 'v1'
  })
}

const client = initClient()

function encodeSegment(segment) {
  return encodeURIComponent(segment)
}

function urlDocPath(segments = []) {
  return `/projects/${projectId}/databases/(default)/documents/${segments.map(encodeSegment).join('/')}`
}

function resourceName(segments = []) {
  return `projects/${projectId}/databases/(default)/documents/${segments.join('/')}`
}

function docIdFromName(name) {
  const raw = String(name || '').split('/').pop() || ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function timestampNow() {
  return new Date().toISOString()
}

async function getDoc(segments) {
  try {
    const response = await client.get(urlDocPath(segments))
    return response.body
  } catch (error) {
    if (error.status === 404 || String(error.message || '').includes('HTTP Error: 404')) return null
    throw error
  }
}

async function listDocs(segments) {
  const docs = []
  let pageToken = ''

  do {
    const queryParams = { pageSize: 100 }
    if (pageToken) queryParams.pageToken = pageToken

    try {
      const response = await client.get(urlDocPath(segments), { queryParams })
      docs.push(...(response.body.documents || []))
      pageToken = response.body.nextPageToken || ''
    } catch (error) {
      if (error.status === 404 || String(error.message || '').includes('HTTP Error: 404')) return docs
      throw error
    }
  } while (pageToken)

  return docs
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)]))
}

function decodeValue(value = {}) {
  if ('nullValue' in value) return null
  if ('booleanValue' in value) return Boolean(value.booleanValue)
  if ('integerValue' in value) {
    const numberValue = Number(value.integerValue)
    return Number.isSafeInteger(numberValue) ? numberValue : { __firestoreInteger: String(value.integerValue) }
  }
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('timestampValue' in value) return { __firestoreTimestamp: value.timestampValue }
  if ('stringValue' in value) return value.stringValue
  if ('bytesValue' in value) return { __firestoreBytes: value.bytesValue }
  if ('referenceValue' in value) return { __firestoreReference: value.referenceValue }
  if ('geoPointValue' in value) return { __firestoreGeoPoint: value.geoPointValue }
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue)
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {})
  return null
}

function encodeFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields || {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeValue(value)])
  )
}

function encodeValue(value) {
  if (value === undefined) return { nullValue: null }
  if (value === null) return { nullValue: null }
  if (value && typeof value === 'object' && value.__firestoreTimestamp) return { timestampValue: value.__firestoreTimestamp }
  if (value && typeof value === 'object' && value.__firestoreInteger) return { integerValue: value.__firestoreInteger }
  if (value && typeof value === 'object' && value.__firestoreBytes) return { bytesValue: value.__firestoreBytes }
  if (value && typeof value === 'object' && value.__firestoreReference) return { referenceValue: value.__firestoreReference }
  if (value && typeof value === 'object' && value.__firestoreGeoPoint) return { geoPointValue: value.__firestoreGeoPoint }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) }
    return { doubleValue: value }
  }
  if (typeof value === 'string') return { stringValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } }
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value) } }
  return { stringValue: String(value) }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function isEmptyValue(value) {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

function arrayItemKey(field, item) {
  if (!item || typeof item !== 'object') return JSON.stringify(item)
  if (!isEmptyValue(item.id)) return `id:${item.id}`

  if (field === 'tasks') {
    return [
      item.type || '',
      item.name || '',
      item.date || '',
      item.weekday || '',
      Array.isArray(item.weekdays) ? item.weekdays.join(',') : '',
      item.startTime || '',
      item.expectedEndTime || ''
    ].join('|')
  }

  if (field === 'doneLogs') return [item.taskId || '', item.name || '', item.date || '', item.status || ''].join('|')
  if (field === 'allowanceEntries') return [item.date || '', item.type || '', item.title || item.memo || '', item.amount || ''].join('|')
  if (field === 'essentials') return `name:${normalizeText(item.name)}`
  if (field === 'rewards') return `reward:${normalizeText(item.text || item.name)}:${item.coins || ''}`
  if (field === 'goals') return `goal:${normalizeText(item.text || item.name || item.title)}`
  if (field === 'wishes') return `wish:${normalizeText(item.text || item.name || item.title)}`
  if (field === 'subjects') return `subject:${normalizeText(item.name)}`

  return JSON.stringify(item)
}

function mergeObjectsKeepingExisting(existing, incoming) {
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return existing
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return existing

  const next = { ...existing }
  for (const [key, value] of Object.entries(incoming)) {
    if (isEmptyValue(next[key]) && !isEmptyValue(value)) next[key] = value
  }
  return next
}

function mergeArrayField(field, docs) {
  const byKey = new Map()

  for (const data of docs) {
    const items = Array.isArray(data?.[field]) ? data[field] : []
    for (const item of items) {
      const key = arrayItemKey(field, item)
      if (!byKey.has(key)) {
        byKey.set(key, clone(item))
      } else {
        byKey.set(key, mergeObjectsKeepingExisting(byKey.get(key), item))
      }
    }
  }

  return [...byKey.values()]
}

function subjectNames(subjects) {
  return (Array.isArray(subjects) ? subjects : [])
    .map((subject) => normalizeText(subject?.name))
    .filter(Boolean)
}

function isDefaultSubjectList(subjects) {
  const names = subjectNames(subjects)
  if (names.length !== DEFAULT_SUBJECT_NAMES.length) return false
  return DEFAULT_SUBJECT_NAMES.every((name) => names.includes(name))
}

function getCoins(item, fallback = 1) {
  const raw = item?.coins
  if (raw === undefined || raw === null || raw === '') return fallback
  const parsed = Number(raw)
  return Number.isNaN(parsed) ? fallback : Math.max(0, parsed)
}

function inferSubjectsFromTasks(tasks) {
  const byName = new Map()

  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (!task || typeof task !== 'object') continue
    if (task.type && task.type !== 'study') continue

    const name = normalizeText(task.name)
    if (!name) continue
    if (byName.has(name)) continue

    byName.set(name, {
      name,
      color: task.color || SUBJECT_COLORS[byName.size % SUBJECT_COLORS.length],
      coins: getCoins(task, 1)
    })
  }

  return [...byName.values()]
}

function pickSubjectList({ mergedTasks, sourceDocs, legacyMetaSubjects }) {
  for (const data of sourceDocs) {
    if (Array.isArray(data?.subjects) && data.subjects.length > 0 && !isDefaultSubjectList(data.subjects)) {
      return { source: 'kid-doc', subjects: data.subjects }
    }
  }

  if (Array.isArray(legacyMetaSubjects) && legacyMetaSubjects.length > 0 && !isDefaultSubjectList(legacyMetaSubjects)) {
    return { source: 'meta/subjects', subjects: legacyMetaSubjects }
  }

  if (inferSubjects) {
    const inferred = inferSubjectsFromTasks(mergedTasks)
    if (inferred.length > 0) return { source: 'tasks', subjects: inferred }
  }

  const canonical = sourceDocs[0]?.subjects
  if (Array.isArray(canonical) && canonical.length > 0) return { source: 'existing-default', subjects: canonical }

  return {
    source: 'default',
    subjects: DEFAULT_SUBJECT_NAMES.map((name, index) => ({
      name,
      color: SUBJECT_COLORS[index],
      coins: 1
    }))
  }
}

function summarizeDoc(data = {}) {
  const summary = {}
  for (const field of ['tasks', 'doneLogs', 'allowanceEntries', 'essentials', 'rewards', 'goals', 'wishes', 'subjects']) {
    if (Array.isArray(data[field])) summary[field] = data[field].length
  }
  if (data.spentCoins !== undefined) summary.spentCoins = data.spentCoins
  if (data.role !== undefined) summary.role = data.role
  if (data.updatedAt !== undefined) summary.updatedAt = data.updatedAt
  return summary
}

function mergeKidGroup(loginId, kidsById, legacyMetaSubjects) {
  const person = PEOPLE[loginId]
  const canonicalId = person.canonicalKidDoc
  const ids = person.aliases.filter((id) => kidsById[id])
  const canonicalData = clone(kidsById[canonicalId]?.data || {})
  const sourceDocs = [canonicalData, ...ids.filter((id) => id !== canonicalId).map((id) => clone(kidsById[id].data || {}))]

  const patch = {
    role: 'child',
    loginId,
    name: person.cleanName,
    displayName: person.displayName,
    legacyAliases: person.aliases.filter((id) => id !== canonicalId && kidsById[id])
  }

  for (const field of ARRAY_FIELDS) {
    const merged = mergeArrayField(field, sourceDocs)
    if (merged.length > 0 || Array.isArray(canonicalData[field])) patch[field] = merged
  }

  const spentCoinsValues = sourceDocs
    .map((data) => Number(data?.spentCoins ?? 0))
    .filter((value) => !Number.isNaN(value))
  patch.spentCoins = Math.max(0, ...spentCoinsValues)

  const rewardValue = sourceDocs.find((data) => data?.allowanceCoinReward !== undefined)?.allowanceCoinReward
  if (rewardValue !== undefined) patch.allowanceCoinReward = Number(rewardValue)

  const subjectPick = pickSubjectList({
    mergedTasks: patch.tasks || [],
    sourceDocs,
    legacyMetaSubjects
  })
  patch.subjects = subjectPick.subjects
  patch.updatedAt = { __firestoreTimestamp: timestampNow() }

  return {
    loginId,
    canonicalId,
    legacyIds: ids.filter((id) => id !== canonicalId),
    sourceIds: ids,
    patch: compactObject(patch),
    subjectSource: subjectPick.source,
    before: summarizeDoc(canonicalData),
    after: summarizeDoc({ ...canonicalData, ...patch })
  }
}

function cleanPeopleMap(householdData = {}) {
  const existingPeople = householdData.people || {}

  const mergedEntry = (loginId) => {
    const person = PEOPLE[loginId]
    const sourceEntries = Object.entries(existingPeople)
      .filter(([key, value]) => person.aliases.includes(key) || value?.loginId === loginId)
      .map(([, value]) => value || {})

    return {
      ...Object.assign({}, ...sourceEntries),
      loginId,
      role: person.role,
      name: person.cleanName,
      displayName: person.displayName
    }
  }

  return {
    엄마: mergedEntry('yhhojt970'),
    손지희: mergedEntry('sjh150717'),
    손가빈: mergedEntry('sgb170101')
  }
}

function makeUpdateWrite(segments, fields, fieldPaths = Object.keys(fields)) {
  return {
    update: {
      name: resourceName(segments),
      fields: encodeFields(fields)
    },
    updateMask: {
      fieldPaths
    }
  }
}

function makeDeleteWrite(segments) {
  return { delete: resourceName(segments) }
}

async function commitWrites(writes) {
  if (writes.length === 0) return
  const maxBatchSize = 400

  for (let index = 0; index < writes.length; index += maxBatchSize) {
    const batch = writes.slice(index, index + maxBatchSize)
    await client.post(`/projects/${projectId}/databases/(default)/documents:commit`, { writes: batch })
  }
}

function ensureBackupDir() {
  const backupDir = path.join(process.cwd(), 'backups', 'firestore-cleanup')
  fs.mkdirSync(backupDir, { recursive: true })
  return backupDir
}

function writeBackup(payload) {
  const backupDir = ensureBackupDir()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(backupDir, `${stamp}_${householdId}.json`)
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return file
}

async function main() {
  const householdDoc = await getDoc(['households', householdId])
  if (!householdDoc) throw new Error(`household not found: ${householdId}`)

  const kidsDocs = await listDocs(['households', householdId, 'kids'])
  const nestedUserDocs = await listDocs(['households', householdId, 'users'])
  const metaSubjectsDoc = await getDoc(['households', householdId, 'meta', 'subjects'])

  const householdData = decodeFields(householdDoc.fields || {})
  const kidsById = Object.fromEntries(
    kidsDocs.map((doc) => [
      docIdFromName(doc.name),
      {
        name: doc.name,
        data: decodeFields(doc.fields || {}),
        raw: doc
      }
    ])
  )
  const nestedUsersById = Object.fromEntries(
    nestedUserDocs.map((doc) => [docIdFromName(doc.name), decodeFields(doc.fields || {})])
  )
  const legacyMetaSubjects = metaSubjectsDoc ? decodeFields(metaSubjectsDoc.fields || {}).subjects : []

  const kidPlans = ['sjh150717', 'sgb170101'].map((loginId) => mergeKidGroup(loginId, kidsById, legacyMetaSubjects))
  const cleanPeople = cleanPeopleMap(householdData)

  const backupPayload = {
    projectId,
    householdId,
    createdAt: timestampNow(),
    mode: applyChanges ? 'apply' : 'dry-run',
    household: { raw: householdDoc, data: householdData },
    kids: kidsById,
    nestedUsers: nestedUsersById,
    metaSubjects: metaSubjectsDoc ? { raw: metaSubjectsDoc, data: decodeFields(metaSubjectsDoc.fields || {}) } : null,
    plans: kidPlans
  }
  const backupFile = writeBackup(backupPayload)

  const report = {
    mode: applyChanges ? 'apply' : 'dry-run',
    backupFile,
    kidsFound: Object.keys(kidsById).sort(),
    nestedUsersFound: Object.keys(nestedUsersById).sort(),
    cleanPeopleKeys: Object.keys(cleanPeople),
    plans: kidPlans.map((plan) => ({
      canonicalId: plan.canonicalId,
      sourceIds: plan.sourceIds,
      legacyIds: plan.legacyIds,
      subjectSource: plan.subjectSource,
      before: plan.before,
      after: plan.after
    })),
    legacyKidsToRemove: LEGACY_KID_DOCS.filter((id) => kidsById[id])
  }

  console.log(JSON.stringify(report, null, 2))

  if (!applyChanges) return

  const now = { __firestoreTimestamp: timestampNow() }
  const writes = []

  writes.push(makeUpdateWrite(['households', householdId], {
    people: cleanPeople,
    updatedAt: now
  }))

  for (const plan of kidPlans) {
    writes.push(makeUpdateWrite(['households', householdId, 'kids', plan.canonicalId], plan.patch))
  }

  for (const [loginId, person] of Object.entries(PEOPLE)) {
    writes.push(makeUpdateWrite(['households', householdId, 'users', loginId], {
      loginId,
      role: person.role,
      name: person.cleanName,
      displayName: person.displayName,
      updatedAt: now
    }))
  }

  if (deleteLegacy) {
    for (const legacyId of LEGACY_KID_DOCS) {
      const doc = kidsById[legacyId]
      if (!doc) continue

      const target = Object.values(PEOPLE).find((person) => person.aliases.includes(legacyId))?.canonicalKidDoc || ''
      writes.push(makeUpdateWrite(['households', householdId, 'legacyKids', legacyId], {
        ...doc.data,
        archivedFrom: `households/${householdId}/kids/${legacyId}`,
        archivedInto: target ? `households/${householdId}/kids/${target}` : '',
        archivedAt: now
      }))
      writes.push(makeDeleteWrite(['households', householdId, 'kids', legacyId]))
    }
  }

  await commitWrites(writes)
  console.log(JSON.stringify({
    applied: true,
    writes: writes.length,
    deletedLegacyKids: deleteLegacy ? LEGACY_KID_DOCS.filter((id) => kidsById[id]) : [],
    backupFile
  }, null, 2))
}

main().catch((error) => {
  console.error(error.stack || error.message || error)
  process.exit(1)
})
