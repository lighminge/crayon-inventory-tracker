import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

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

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
