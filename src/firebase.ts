import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: "AIzaSyAdcWfaFSobqOaI29ZeT2egbqwXUpDRs2g",
  authDomain: "crayon-inventory-db.firebaseapp.com",
  projectId: "crayon-inventory-db",
  storageBucket: "crayon-inventory-db.firebasestorage.app",
  messagingSenderId: "123485099280",
  appId: "1:123485099280:web:4813cc463ae8ca4ad60195",
  measurementId: "G-FSNTJHJ3BG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize App Check
if (typeof window !== 'undefined') {
  // 在本機開發環境 (localhost) 啟用 Debug Token，否則 Firebase 會阻擋本機連線
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider('6LdsdKMtAAAAAAdj6iEMvolYa19W8FuZxE9KNFoe'),
    isTokenAutoRefreshEnabled: true
  });
}

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
