import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFunctions } from 'firebase/functions'
import { getFirestore } from 'firebase/firestore'
import { firebaseConfig } from './firebaseConfig'

const app = initializeApp(firebaseConfig)

export { app }
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app)

let secondaryApp = null

export const getSecondaryFirebase = () => {
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, 'secondary-auth-app')
  }

  return {
    app: secondaryApp,
    auth: getAuth(secondaryApp),
    db: getFirestore(secondaryApp)
  }
}
