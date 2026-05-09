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
