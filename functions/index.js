const { logger } = require('firebase-functions')
const { onDocumentWritten } = require('firebase-functions/v2/firestore')
const admin = require('firebase-admin')

admin.initializeApp()

const db = admin.firestore()

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
