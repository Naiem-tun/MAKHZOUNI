import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithRedirect,
  getRedirectResult,
  RecaptchaVerifier,
  Auth,
  signInWithPopup,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDocFromServer, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  Firestore
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase with singleton pattern
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);

export const auth: Auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);

auth.useDeviceLanguage();

export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();

export const testConnection = async () => {
  if (!navigator.onLine) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    console.error("Connection test failed:", error);
  }
};

export const setupRecaptcha = (container: string | HTMLElement) => {
  try {
    if (!auth) throw new Error('Auth not initialized');
    
    // Explicitly check container
    const containerElement = typeof container === 'string' ? document.getElementById(container) : container;
    if (!containerElement) {
      console.warn('Recaptcha container not found, skipping initialization');
      return null;
    }

    return new RecaptchaVerifier(auth, container, {
      size: 'invisible',
      callback: () => {}
    });
  } catch (error) {
    console.error('Failed to initialize reCAPTCHA:', error);
    return null;
  }
};

export const getGoogleRedirectResult = () => getRedirectResult(auth);
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
