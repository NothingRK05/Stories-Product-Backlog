import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword, 
  GoogleAuthProvider,
  signInWithPopup
 } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase.js";

document.querySelector("form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "/projects";
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById("googleLoginBtn").addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check if user profile exists already
    const userSnap = await getDoc(doc(db, "users", user.uid));

    if (!userSnap.exists()) {
      // First time Google login — create profile using Google display name
      const displayName = user.displayName || "User";
      const usernameLower = displayName.toLowerCase().replace(/\s+/g, "_");

      await setDoc(doc(db, "usernames", usernameLower), {
        uid: user.uid,
        email: user.email,
        displayName
      });

      await setDoc(doc(db, "users", user.uid), {
        displayName,
        usernameRaw: displayName,
        usernameLower,
        email: user.email,
        createdAt: Date.now()
      }, { merge: true });
    }

    window.location.href = "/projects";
  } catch (err) {
    alert(err.message);
  }
});