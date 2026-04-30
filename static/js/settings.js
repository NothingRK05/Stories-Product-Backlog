// Sidebar switching
document.addEventListener("DOMContentLoaded", () => {
    const items = document.querySelectorAll(".sidebar-item");
    const sections = document.querySelectorAll(".settings-section");

    items.forEach(item => {
        item.addEventListener("click", () => {
            // highlight active sidebar item
            items.forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            // show the correct section
            const target = item.dataset.section;

            sections.forEach(sec => {
                sec.classList.toggle("hidden", sec.id !== target);
            });
        });
    });
    // THEME PERSISTENCE
    const html = document.documentElement;
    const settingsToggle = document.getElementById("settingsThemeToggle");

    // Load saved theme
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
        html.setAttribute("data-theme", savedTheme);
        settingsToggle.checked = savedTheme === "dark";
    }

    // Toggle theme
    settingsToggle.addEventListener("change", () => {
        const newTheme = settingsToggle.checked ? "dark" : "light";
        html.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
    });
});


// Load user info
auth.onAuthStateChanged(user => {
    if (!user) return;

    document.getElementById("accountEmail").textContent = user.email;
    document.getElementById("accountUID").textContent = user.uid;
    document.getElementById("displayName").context = user.displayName;

    // Save new display name
    document.getElementById("saveNameBtn").addEventListener("click", async () => {
        const newName = document.getElementById("newDisplayName").value;

        if (!newName.trim()) return alert("Name cannot be empty");

        await user.updateProfile({ displayName: newName });
        alert("Name updated!");
    });
});