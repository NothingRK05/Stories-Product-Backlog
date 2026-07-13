import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showPopup } from "./popup.js";

document.querySelector("form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const usernameRaw   = document.getElementById("signupName").value.trim();
  const email         = document.getElementById("signupEmail").value.trim();
  const password      = document.getElementById("signupPassword").value.trim();
  const usernameLower = usernameRaw.toLowerCase();

  if (!usernameRaw) {
    showPopup("Missing Username", "Please enter a username.");
    return;
  }

  try {
    // Check username availability before creating the auth account
    const usernameRef  = doc(db, "usernames", usernameLower);
    const usernameSnap = await getDoc(usernameRef);

    if (usernameSnap.exists()) {
      showPopup("Username Taken", "That username is already taken. Please choose another.");
      return;
    }

    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    // Write username lookup doc and user profile doc
    await setDoc(usernameRef, {
      uid: user.uid,
      email: email.toLowerCase(),
      displayName: usernameRaw
    });

    await setDoc(doc(db, "users", user.uid), {
      displayName: usernameRaw,
      usernameRaw,
      usernameLower,
      email: user.email,
      createdAt: Date.now()
    }, { merge: true });

    await updateProfile(user, { displayName: usernameRaw });
    window.location.href = "/projects";

  } catch (err) {
    console.error(err);
    showPopup("Sign Up Error", err.message);
  }
});

document.getElementById("googleSignupBtn").addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userSnap = await getDoc(doc(db, "users", user.uid));

    if (!userSnap.exists()) {
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
    showPopup("Google Sign Up Error", err.message);
  }
});