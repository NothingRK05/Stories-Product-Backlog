auth.onAuthStateChanged((user) => {
    const authArea = document.getElementById("authArea");
    const userDisplay = document.getElementById("currentUserDisplay");

    if (!authArea) return;

    if (user) {
        const initial = user.displayName
            ? user.displayName.charAt(0).toUpperCase()
            : "U";

        authArea.innerHTML = `
            <div class="profile-icon" id="profileIcon">${initial}</div>
            <div class="profile-menu" id="profileMenu">
                <div class="profile-menu-item" id="logoutBtn">Log Out</div>
            </div>
        `;

        if (userDisplay) {
            userDisplay.textContent = `Logged in as: ${user.displayName || user.email}`;
        }

        const icon = document.getElementById("profileIcon");
        const menu = document.getElementById("profileMenu");
        const logoutBtn = document.getElementById("logoutBtn");

        icon.addEventListener("click", () => {
            menu.classList.toggle("show");
        });

        logoutBtn.addEventListener("click", async () => {
            await auth.signOut();
            window.location.href = "/";
        });

    } else {
        authArea.innerHTML = `
            <a href="/static/logins/login.html" class="nav-btn">Login</a>
            <a href="/static/logins/signup.html" class="nav-btn signup">Sign Up</a>
        `;

        if (userDisplay) {
            userDisplay.textContent = "";
        }
    }
});
