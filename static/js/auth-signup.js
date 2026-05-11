// auth-signup.js (modular)
import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  setDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.querySelector("form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(userCred.user, { displayName: name });

    await setDoc(doc(db, "users", userCred.user.uid), {
      displayName: name,
      email: email,
      createdAt: Date.now()
    });

    window.location.href = "/projects";
  } catch (err) {
    alert(err.message);
  }
});