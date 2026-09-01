import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

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
  // 設定在開發環境可以透過 debug token 繞過限制 (選擇性)
  // self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LdsdKMtAAAAAAdj6iEMvolYa19W8FuZxE9KNFoe'),
    isTokenAutoRefreshEnabled: true
  });
}

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
