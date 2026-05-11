import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ---------------------------------------------------------
   SIDEBAR SWITCHING
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const items = document.querySelectorAll(".sidebar-item");
  const sections = document.querySelectorAll(".settings-section");

  items.forEach(item => {
    item.addEventListener("click", () => {
      items.forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      const target = item.dataset.section;

      sections.forEach(sec => {
        sec.classList.toggle("hidden", sec.id !== target);
      });
    });
  });

  /* ---------------------------------------------------------
     THEME PERSISTENCE
  --------------------------------------------------------- */
  const html = document.documentElement;
  const settingsToggle = document.getElementById("settingsThemeToggle");

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    html.setAttribute("data-theme", savedTheme);
    settingsToggle.checked = savedTheme === "dark";
  }

  settingsToggle.addEventListener("change", () => {
    const newTheme = settingsToggle.checked ? "dark" : "light";
    html.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  });
});

/* ---------------------------------------------------------
   LOAD USER INFO + SAVE NAME
--------------------------------------------------------- */
onAuthStateChanged(auth, (user) => {
  if (!user) return;

  document.getElementById("accountEmail").textContent = user.email;
  document.getElementById("accountUID").textContent = user.uid;
  document.getElementById("displayName").textContent = user.displayName || "(none)";

  document.getElementById("saveNameBtn").addEventListener("click", async () => {
    const newName = document.getElementById("newDisplayName").value.trim();

    if (!newName) {
      alert("Name cannot be empty");
      return;
    }

    try {
      await updateProfile(user, { displayName: newName });
      alert("Name updated!");

      document.getElementById("displayName").textContent = newName;
    } catch (err) {
      alert(err.message);
    }
  });
});
