import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.querySelector("form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const usernameRaw = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value.trim();
  const usernameDisplay = usernameRaw;
  const usernameLower = usernameRaw.toLowerCase();

  try {
    const usernameRef = doc(db, "usernames", usernameLower);
    const usernameSnap = await getDoc(usernameRef);

    if (usernameSnap.exists()) {
      alert("That username is already taken.");
      return;
    }

    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    await setDoc(usernameRef, { uid: user.uid, email: email.toLowerCase() });

    await setDoc(
      doc(db, "users", user.uid),
      {
        displayName: usernameDisplay,
        usernameRaw: usernameDisplay,
        usernameLower: usernameLower,
        email: user.email,
        createdAt: Date.now()
      },
      { merge: true }
    );

    await updateProfile(user, { displayName: usernameDisplay });
    window.location.href = "/projects";

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});
