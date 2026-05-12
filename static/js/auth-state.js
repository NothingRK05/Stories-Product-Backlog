import { auth, db } from "../js/firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const authArea = document.getElementById("authArea");

export let currentUserInfo = {
  uid: null,
  usernameLower: null,
  displayName: null,
  email: null
};

// Binds logo click — routes to /projects if logged in, / if not
function bindLogo(loggedIn) {
  const logo = document.querySelector(".logo");
  if (!logo) return;

  const clone = logo.cloneNode(true);
  logo.parentNode.replaceChild(clone, logo);

  clone.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = loggedIn ? "/projects" : "/";
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUserInfo = { uid: null, usernameLower: null, displayName: null, email: null };
    if (authArea) authArea.innerHTML = "";
    bindLogo(false);
    return;
  }

  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (!userSnap.exists()) {
    console.error("users/{uid} doc missing");
    return;
  }

  const usernameLower = userSnap.data().usernameLower;
  const usernameSnap = await getDoc(doc(db, "usernames", usernameLower));
  if (!usernameSnap.exists()) {
    console.error("usernames/{usernameLower} doc missing");
    return;
  }

  const data = usernameSnap.data();

  currentUserInfo = {
    uid: data.uid,
    usernameLower,
    displayName: data.displayName,
    email: data.email
  };

  window.currentUserInfo = currentUserInfo;

  const initial = currentUserInfo.displayName.trim().charAt(0).toUpperCase();

  authArea.innerHTML = `
    <div class="profile-icon" id="profileIcon">${initial}</div>
    <div class="profile-menu" id="profileMenu">
      <div class="profile-menu-item" data-action="projects">My Projects</div>
      <div class="profile-menu-item" data-action="settings">Settings</div>
      <div class="profile-menu-item" data-action="logout">Logout</div>
    </div>
  `;

  const profileIcon = document.getElementById("profileIcon");
  const profileMenu = document.getElementById("profileMenu");

  profileIcon.onclick = () => profileMenu.classList.toggle("show");

  document.addEventListener("click", (e) => {
    if (!profileMenu.contains(e.target) && e.target !== profileIcon) {
      profileMenu.classList.remove("show");
    }
  });

  profileMenu.addEventListener("click", async (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    if (action === "projects") window.location.href = "/projects";
    if (action === "settings") window.location.href = "/logins/settings.html";
    if (action === "logout") {
      await signOut(auth);
      window.location.href = "/";
    }
  });

  bindLogo(true);
});