import { auth, db } from "../js/firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const authArea = document.getElementById("authArea");

export let currentUserInfo = {
  uid: null,
  usernameLower: null,
  displayName: null,
  email: null
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUserInfo = { uid: null, usernameLower: null, displayName: null, email: null };
    if (authArea) {
      authArea.innerHTML = `<a href="/login" class="btn">Login</a>`;
    }
    return;
  }

  const uid = user.uid;
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data();
    currentUserInfo = {
      uid,
      usernameLower: data.usernameLower,
      displayName: data.displayName || "",
      email: data.email || user.email || ""
    };
  } else {
    currentUserInfo = {
      uid,
      usernameLower: null,
      displayName: user.displayName || "",
      email: user.email || ""
    };
  }

  if (authArea) {
    authArea.innerHTML = `
      <span class="user-label">${currentUserInfo.displayName || currentUserInfo.email}</span>
      <button id="logoutBtn" class="btn">Logout</button>
    `;
    document.getElementById("logoutBtn").onclick = () => auth.signOut();
  }

  window.currentUserInfo = currentUserInfo;
});