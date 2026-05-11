// auth-state.js (modular)
import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    const authArea = document.getElementById("authArea");
    const userDisplay = document.getElementById("currentUserDisplay");

    if (!authArea) return;
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
        document.documentElement.setAttribute("data-theme", savedTheme);
    }

    if (user) {
        const initial = user.displayName
            ? user.displayName.charAt(0).toUpperCase()
            : user.email.charAt(0).toUpperCase();

        authArea.innerHTML = `
            <div class="profile-icon" id="profileIcon">${initial}</div>
            <div class="profile-menu" id="profileMenu">
                <div class="profile-menu-item" id="settingsBtn">Settings</div>
                <div class="profile-menu-item" id="productsBtn">My Products</div>
                <div class="profile-menu-item" id="logoutBtn">Log Out</div>
            </div>
        `;

        if (userDisplay) {
            userDisplay.textContent = `Logged in as: ${user.displayName || user.email}`;
        }

        const icon = document.getElementById("profileIcon");
        const menu = document.getElementById("profileMenu");
        const logoutBtn = document.getElementById("logoutBtn");
        const settingsBtn = document.getElementById("settingsBtn");
        const productsBtn = document.getElementById("productsBtn");

        icon.addEventListener("click", () => {
            menu.classList.toggle("show");
        });

        logoutBtn.addEventListener("click", async () => {
            await signOut(auth);
            window.location.href = "/";
        });

        settingsBtn.addEventListener("click", () => {
            window.location.href = "/logins/settings.html";
        });

        productsBtn.addEventListener("click", () => {
            window.location.href = "/projects";
        });

    } else {
        authArea.innerHTML = `
            <a href="/logins/login.html" class="nav-btn">Login</a>
            <a href="/logins/signup.html" class="nav-btn signup">Sign Up</a>
        `;

        if (userDisplay) {
            userDisplay.textContent = "";
        }
    }
});
