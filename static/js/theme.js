// Get saved theme or default to light mode
const savedTheme = localStorage.getItem("theme") || "dark";

// Apply theme to the entire page
document.documentElement.setAttribute("data-theme", savedTheme);