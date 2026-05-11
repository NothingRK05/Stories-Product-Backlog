import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDcWb980e-FXMugxnx6jE1CZB3WrVFw4-4",
  authDomain: "stories-dec4a.firebaseapp.com",
  databaseURL: "https://stories-dec4a-default-rtdb.firebaseio.com",
  projectId: "stories-dec4a",
  storageBucket: "stories-dec4a.firebasestorage.app",
  messagingSenderId: "95187761797",
  appId: "1:95187761797:web:bf377dc3852526bf7187ec",
  measurementId: "G-7PBGNCC6K9"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
