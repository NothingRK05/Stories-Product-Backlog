import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Sidebar section switching
document.addEventListener("DOMContentLoaded", () => {
  const items = document.querySelectorAll(".sidebar-item");
  const sections = document.querySelectorAll(".settings-section");

  items.forEach(item => {
    item.addEventListener("click", () => {
      items.forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      sections.forEach(sec => sec.classList.toggle("hidden", sec.id !== item.dataset.section));
    });
  });

  // Theme toggle with localStorage persistence
  const html = document.documentElement;
  const toggle = document.getElementById("settingsThemeToggle");
  const saved = localStorage.getItem("theme");

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

// Load user info and handle display name update
onAuthStateChanged(auth, (user) => {
  if (!user) return;

  document.getElementById("accountEmail").textContent = user.email;
  document.getElementById("accountUID").textContent = user.uid;
  document.getElementById("displayName").textContent = user.displayName || "(none)";

  document.getElementById("saveNameBtn").addEventListener("click", async () => {
    const newName = document.getElementById("newDisplayName").value.trim();

    if (!newName) {
      alert("Name cannot be empty.");
      return;
    }

    try {
      await updateProfile(user, { displayName: newName });
      document.getElementById("displayName").textContent = newName;
      alert("Name updated!");
    } catch (err) {
      alert(err.message);
    }
  });
});