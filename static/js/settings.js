import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showPopup } from "./popup.js";

// Sidebar section switching
document.addEventListener("DOMContentLoaded", () => {
  const items    = document.querySelectorAll(".sidebar-item");
  const sections = document.querySelectorAll(".settings-section");

  items.forEach(item => {
    item.addEventListener("click", () => {
      items.forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      sections.forEach(sec => sec.classList.toggle("hidden", sec.id !== item.dataset.section));
    });
  });

  // Theme toggle with localStorage persistence
  const html   = document.documentElement;
  const toggle = document.getElementById("settingsThemeToggle");
  const saved  = localStorage.getItem("theme");

  if (saved) {
    html.setAttribute("data-theme", saved);
    toggle.checked = saved === "dark";
  }

  toggle.addEventListener("change", () => {
    const theme = toggle.checked ? "dark" : "light";
    html.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  });
});

// Load user info and handle username update
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  // Load current username from Firestore to display accurate stored value
  const userSnap = await getDoc(doc(db, "users", user.uid));
  const usernameLower = userSnap.exists() ? userSnap.data().usernameLower : "";

  document.getElementById("accountEmail").textContent    = user.email;
  document.getElementById("accountUID").textContent      = user.uid;
  document.getElementById("displayName").textContent     = userSnap.exists()
    ? userSnap.data().usernameRaw || usernameLower
    : user.displayName || "(none)";

  document.getElementById("saveNameBtn").addEventListener("click", async () => {
    const newNameRaw   = document.getElementById("newDisplayName").value.trim();
    const newNameLower = newNameRaw.toLowerCase();

    if (!newNameRaw) {
      showPopup("Missing Username", "Please enter a new username.");
      return;
    }

    if (newNameLower === usernameLower) {
      showPopup("No Change", "That is already your current username.");
      return;
    }

    try {
      // Check if the new username is already taken
      const newUsernameSnap = await getDoc(doc(db, "usernames", newNameLower));
      if (newUsernameSnap.exists()) {
        showPopup("Username Taken", "That username is already taken. Please choose another.");
        return;
      }

      // Write new username doc
      await setDoc(doc(db, "usernames", newNameLower), {
        uid: user.uid,
        email: user.email.toLowerCase(),
        displayName: newNameRaw
      });

      // Delete old username doc
      if (usernameLower) {
        await deleteDoc(doc(db, "usernames", usernameLower));
      }

      // Update users doc
      await setDoc(doc(db, "users", user.uid), {
        displayName:    newNameRaw,
        usernameRaw:    newNameRaw,
        usernameLower:  newNameLower
      }, { merge: true });

      // Update Firebase Auth profile
      await updateProfile(user, { displayName: newNameRaw });

      document.getElementById("displayName").textContent = newNameRaw;
      showPopup("Username Updated", `Your username has been changed to "${newNameRaw}".`);

    } catch (err) {
      console.error(err);
      showPopup("Update Error", err.message);
    }
  });
});