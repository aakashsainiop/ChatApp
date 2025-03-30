import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDArVyNrP65ZzJ5ZKLonBgUOcUz-cc5Dck",
  authDomain: "chatapp-bfdab.firebaseapp.com",
  projectId: "chatapp-bfdab",
  storageBucket: "chatapp-bfdab.firebasestorage.app",
  messagingSenderId: "510072059543",
  appId: "1:510072059543:web:ae9d635a373c4e5630dbd2",
  measurementId: "G-9GEJKEQVYY",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
