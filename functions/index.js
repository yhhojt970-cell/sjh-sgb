const { logger } = require('firebase-functions')
const { onDocumentWritten } = require('firebase-functions/v2/firestore')
const { HttpsError, onCall } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')
const crypto = require('crypto')

admin.initializeApp()

const db = admin.firestore()
const DEFAULT_HOUSEHOLD_ID = 'SJH-SGB'
const ADMIN_LOGIN_IDS = new Set(['yhhojt970'])
const CHILD_LOGIN_IDS = new Set(['sjh150717', 'sgb170101'])
const PASSWORD_RESET_CODE_TTL_MS = 60 * 60 * 1000

const isAdminProfile = (profile = {}) => {
  return profile.role === 'admin' || profile.name === '엄마' || ADMIN_LOGIN_IDS.has(profile.loginId)
}

const normalizeLoginId = (value) => String(value || '').trim().toLowerCase()
const generateResetCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0')

const getMessages = (snapshot) => {
  if (!snapshot?.exists) return []
  const data = snapshot.data() || {}
  return Array.isArray(data.messages) ? data.messages : []
}

const getMessageKey = (message) => {
  if (message?.id !== undefined && message?.id !== null) return String(message.id)
  return [message?.kidId || '', message?.createdAt || '', message?.date || '', message?.text || ''].join('|')
}

const chunk = (items, size) => {
  const chunks = []
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
  return chunks
}

const getNotificationSettings = async (householdId, userId) => {
  try {
    const snap = await db
      .collection('households')
      .doc(householdId)
      .collection('users')
      .doc(userId)
      .collection('notificationSettings')
      .doc('preferences')
      .get()

    if (snap.exists()) {
      return snap.data()
    }
  } catch (error) {
    logger.warn('Failed to get notification settings', { householdId, userId, error: error.message })
  }

  return {
    taskCreated: true,
    taskUpdated: true,
    taskDeleted: false,
    taskCompleted: true,
    allowanceCreated: true
  }
}

const getUserName = async (householdId, userId) => {
  try {
    const snap = await db
      .collection('households')
      .doc(householdId)
      .collection('users')
      .doc(userId)
      .get()

    const data = snap.data() || {}
    return data.displayName || data.name || userId
  } catch {
    return userId
  }
}

const getTokenDocs = async ({ householdId, role, kidId }) => {
  let query = db
    .collection('households')
    .doc(householdId)
    .collection('notificationTokens')
    .where('enabled', '==', true)
    .where('role', '==', role)

  if (role === 'child') query = query.where('kidId', '==', kidId)

  const snapshot = await query.get()
  return snapshot.docs.filter((tokenDoc) => Boolean(tokenDoc.data()?.token))
}

const deleteInvalidTokens = async (tokenDocs, responses) => {
  const invalidCodes = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered'
  ])

  const deletes = []
  responses.forEach((response, index) => {
    const code = response.error?.code
    if (!response.success && invalidCodes.has(code) && tokenDocs[index]) {
      deletes.push(tokenDocs[index].ref.delete())
    }
  })

  await Promise.all(deletes)
}

const sendToTokens = async ({ tokenDocs, title, body, data = {} }) => {
  if (tokenDocs.length === 0) return

  for (const docs of chunk(tokenDocs, 500)) {
    const tokens = docs.map((tokenDoc) => tokenDoc.data().token)
    const messageData = Object.fromEntries(
      Object.entries({
        ...data,
        title,
        body,
        url: data.url || '.'
      }).map(([key, value]) => [key, String(value ?? '')])
    )
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      data: messageData
    })

    await deleteInvalidTokens(docs, response.responses)
  }
}

exports.resetChildPassword = onCall(async (request) => {
  const uid = request.auth?.uid
  if (!uid) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.')
  }

  const householdId = String(request.data?.householdId || DEFAULT_HOUSEHOLD_ID).trim()
  const kidLoginId = normalizeLoginId(request.data?.kidLoginId)
  const requestId = String(request.data?.requestId || '').trim()
  const newPassword = String(request.data?.newPassword || '').trim()

  if (!householdId || !CHILD_LOGIN_IDS.has(kidLoginId)) {
    throw new HttpsError('invalid-argument', '아이 계정을 확인해 주세요.')
  }

  if (newPassword.length < 6) {
    throw new HttpsError('invalid-argument', '새 비밀번호는 6자 이상이어야 합니다.')
  }

  const profileSnap = await db.collection('users').doc(uid).get()
  const profile = profileSnap.data() || {}
  const profileHouseholdId = profile.householdId || DEFAULT_HOUSEHOLD_ID

  if (!isAdminProfile(profile) || profileHouseholdId !== householdId) {
    throw new HttpsError('permission-denied', '엄마 계정만 아이 비밀번호를 초기화할 수 있습니다.')
  }

  const childEmail = `${kidLoginId}@kidschedule.local`
  let childUser
  try {
    childUser = await admin.auth().getUserByEmail(childEmail)
  } catch (error) {
    logger.warn('Child auth user not found for password reset', { kidLoginId, error: error.message })
    throw new HttpsError('not-found', '아이 계정을 찾을 수 없습니다.')
  }

  await admin.auth().updateUser(childUser.uid, { password: newPassword })

  if (requestId) {
    await db
      .collection('households')
      .doc(householdId)
      .collection('passwordResetRequests')
      .doc(requestId)
      .set({
        status: 'resolved',
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedBy: profile.loginId || uid
      }, { merge: true })
  }

  logger.info('Child password reset completed', { householdId, kidLoginId, requestId, adminUid: uid })
  return { ok: true }
})

exports.approveChildPasswordReset = onCall(async (request) => {
  const uid = request.auth?.uid
  if (!uid) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.')
  }

  const householdId = String(request.data?.householdId || DEFAULT_HOUSEHOLD_ID).trim()
  const kidLoginId = normalizeLoginId(request.data?.kidLoginId)
  const requestId = String(request.data?.requestId || '').trim()

  if (!householdId || !CHILD_LOGIN_IDS.has(kidLoginId) || !requestId) {
    throw new HttpsError('invalid-argument', '초기화 요청을 확인해 주세요.')
  }

  const profileSnap = await db.collection('users').doc(uid).get()
  const profile = profileSnap.data() || {}
  const profileHouseholdId = profile.householdId || DEFAULT_HOUSEHOLD_ID

  if (!isAdminProfile(profile) || profileHouseholdId !== householdId) {
    throw new HttpsError('permission-denied', '엄마 계정만 초기화 코드를 만들 수 있습니다.')
  }

  const requestRef = db.collection('passwordResetRequests').doc(requestId)
  const requestSnap = await requestRef.get()
  const resetRequest = requestSnap.data() || {}

  if (!requestSnap.exists || resetRequest.householdId !== householdId || resetRequest.kidLoginId !== kidLoginId) {
    throw new HttpsError('not-found', '초기화 요청을 찾을 수 없습니다.')
  }

  if (resetRequest.status === 'resolved') {
    throw new HttpsError('failed-precondition', '이미 완료된 요청입니다.')
  }

  const resetCode = generateResetCode()
  const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MS))

  await requestRef.set({
    status: 'approved',
    resetCode,
    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    approvedBy: profile.loginId || uid,
    expiresAt
  }, { merge: true })

  logger.info('Child password reset approved', { householdId, kidLoginId, requestId, adminUid: uid })
  return { ok: true, resetCode }
})

exports.completeChildPasswordReset = onCall(async (request) => {
  const householdId = String(request.data?.householdId || DEFAULT_HOUSEHOLD_ID).trim()
  const kidLoginId = normalizeLoginId(request.data?.kidLoginId)
  const resetCode = String(request.data?.resetCode || '').trim()
  const newPassword = String(request.data?.newPassword || '').trim()

  if (!householdId || !CHILD_LOGIN_IDS.has(kidLoginId)) {
    throw new HttpsError('invalid-argument', '아이 계정을 확인해 주세요.')
  }

  if (!/^\d{6}$/.test(resetCode)) {
    throw new HttpsError('invalid-argument', '초기화 코드를 확인해 주세요.')
  }

  if (newPassword.length < 6) {
    throw new HttpsError('invalid-argument', '새 비밀번호는 6자 이상이어야 합니다.')
  }

  const requestSnapshot = await db
    .collection('passwordResetRequests')
    .where('resetCode', '==', resetCode)
    .limit(10)
    .get()

  const requestDoc = requestSnapshot.docs.find((docSnap) => {
    const data = docSnap.data() || {}
    return data.householdId === householdId && data.kidLoginId === kidLoginId && data.status === 'approved'
  })

  if (!requestDoc) {
    throw new HttpsError('not-found', '사용할 수 있는 초기화 코드를 찾을 수 없습니다.')
  }

  const resetRequest = requestDoc.data() || {}
  const expiresAt = resetRequest.expiresAt?.toDate?.()
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    await requestDoc.ref.set({
      status: 'expired',
      expiredAt: admin.firestore.FieldValue.serverTimestamp(),
      resetCode: admin.firestore.FieldValue.delete()
    }, { merge: true })
    throw new HttpsError('failed-precondition', '초기화 코드가 만료되었습니다.')
  }

  const childEmail = `${kidLoginId}@kidschedule.local`
  let childUser
  try {
    childUser = await admin.auth().getUserByEmail(childEmail)
  } catch (error) {
    logger.warn('Child auth user not found while completing password reset', { kidLoginId, error: error.message })
    throw new HttpsError('not-found', '아이 계정을 찾을 수 없습니다.')
  }

  await admin.auth().updateUser(childUser.uid, { password: newPassword })
  await requestDoc.ref.set({
    status: 'resolved',
    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    resetCode: admin.firestore.FieldValue.delete()
  }, { merge: true })

  logger.info('Child password reset completed by child', { householdId, kidLoginId, requestId: requestDoc.id })
  return { ok: true }
})

exports.notifyFamilyMessages = onDocumentWritten('households/{householdId}/meta/messages', async (event) => {
  const householdId = event.params.householdId
  const beforeMessages = getMessages(event.data?.before)
  const afterMessages = getMessages(event.data?.after)
  const beforeByKey = new Map(beforeMessages.map((message) => [getMessageKey(message), message]))

  const newMessages = afterMessages.filter((message) => {
    if (message?.kind === 'system') return false
    return !beforeByKey.has(getMessageKey(message)) && message?.kidId && message?.text
  })

  const newReplies = afterMessages.filter((message) => {
    if (message?.kind === 'system') return false
    const before = beforeByKey.get(getMessageKey(message))
    return before && message?.reply && message.reply !== before.reply
  })

  for (const message of newMessages) {
    const tokenDocs = await getTokenDocs({ householdId, role: 'child', kidId: String(message.kidId) })
    await sendToTokens({
      tokenDocs,
      title: '새 메시지가 도착했어요',
      body: String(message.text).slice(0, 120),
      data: {
        kind: 'family-message',
        messageId: getMessageKey(message),
        kidId: message.kidId,
        url: '.'
      }
    })
  }

  for (const message of newReplies) {
    const tokenDocs = await getTokenDocs({ householdId, role: 'admin' })
    await sendToTokens({
      tokenDocs,
      title: '답장이 도착했어요',
      body: String(message.reply).slice(0, 120),
      data: {
        kind: 'family-reply',
        messageId: getMessageKey(message),
        kidId: message.kidId || '',
        url: '.'
      }
    })
  }

  logger.info('Family push notifications processed', {
    householdId,
    newMessages: newMessages.length,
    newReplies: newReplies.length
  })
})

/**
 * 알림 큐 처리: notificationQueue 문서의 새 항목들을 처리하고 FCM으로 발송
 */
exports.processNotificationQueue = onDocumentWritten('households/{householdId}/meta/notificationQueue', async (event) => {
  const householdId = event.params.householdId
  const afterData = event.data?.after?.data() || {}
  const queue = Array.isArray(afterData.queue) ? afterData.queue : []

  const unprocessedItems = queue.filter((item) => item.processed !== true)

  for (const notifItem of unprocessedItems) {
    try {
      const { type, kidId, title, body, taskName } = notifItem

      // 알림 설정 확인
      const settings = await getNotificationSettings(householdId, kidId)
      const settingsMap = {
        'task-created': settings.taskCreated,
        'task-updated': settings.taskUpdated,
        'task-deleted': settings.taskDeleted,
        'task-completed': settings.taskCompleted,
        'allowance-created': settings.allowanceCreated
      }

      const shouldNotify = settingsMap[type]
      if (!shouldNotify) {
        logger.info('Notification skipped due to settings', { householdId, kidId, type })
        continue
      }

      // 엄마에게 알림 (모든 일정 관련)
      const adminTokenDocs = await getTokenDocs({ householdId, role: 'admin' })
      if (adminTokenDocs.length > 0) {
        await sendToTokens({
          tokenDocs: adminTokenDocs,
          title: `[${await getUserName(householdId, kidId)}] ${title}`,
          body: `${body}${taskName ? ` (${taskName})` : ''}`,
          data: {
            kind: type,
            kidId,
            taskName,
            url: '.'
          }
        })
      }

      // 해당 아이에게도 알림 (task-completed, allowance-created 등)
      if (type === 'task-completed' || type === 'allowance-created' || type === 'task-created') {
        const childTokenDocs = await getTokenDocs({ householdId, role: 'child', kidId })
        if (childTokenDocs.length > 0) {
          await sendToTokens({
            tokenDocs: childTokenDocs,
            title,
            body,
            data: {
              kind: type,
              kidId,
              taskName,
              url: '.'
            }
          })
        }
      }

      logger.info('Notification sent', { householdId, kidId, type })
    } catch (error) {
      logger.error('Failed to send notification', { householdId, error: error.message })
    }
  }

  // 모든 항목을 processed=true로 업데이트
  if (unprocessedItems.length > 0) {
    const updatedQueue = queue.map((item) => ({
      ...item,
      processed: true
    }))

    await db
      .collection('households')
      .doc(householdId)
      .collection('meta')
      .doc('notificationQueue')
      .update({
        queue: updatedQueue,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
  }

  logger.info('Notification queue processed', {
    householdId,
    itemsProcessed: unprocessedItems.length
  })
})
