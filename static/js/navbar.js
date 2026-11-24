(() => {
    const header = document.querySelector(".header");
    const logo = header?.querySelector(".logo");

    if (!logo) return;

    const projectId = new URLSearchParams(
        window.location.search
    ).get("project");

    const currentPage = window.location.pathname
        .replace(/\/index\.html$/, "")
        .replace(/\/$/, "");

    const nav = document.createElement("div");
    nav.className = "nav-left";

    logo.before(nav);
    nav.appendChild(logo);

    nav.insertAdjacentHTML("afterbegin", `
        <button id="menuToggle"
                class="hamburger"
                aria-label="Navigation"
                aria-expanded="false"
                aria-controls="navigationMenu">
            ☰
        </button>

        <nav id="navigationMenu"
             class="navigation-menu" hidden>

            <h4>Workspace</h4>

            <a href="/">Home</a>
            <a href="/projects">My Products</a>
            <a href="/about">About</a>

            <div id="projectNavigation"></div>
            <div id="pageActions"></div>
        </nav>
    `);

    const button = document.getElementById("menuToggle");
    const menu = document.getElementById("navigationMenu");
    const projectNav = document.getElementById("projectNavigation");
    const actions = document.getElementById("pageActions");

    const oldContainers = new Set();

    // Move existing buttons without removing their functionality
    function moveControl(control, destination) {
        oldContainers.add(control.parentElement);
        destination.appendChild(control);
    }

    // Project navigation
    if (projectId) {
        projectNav.innerHTML = "<hr><h4>Project Navigation</h4>";

        const pages = [
            ["Product Backlog", "/product-backlog", ["switchProductBtn"]],
            ["Sprint Backlog", "/sprint-backlog", ["switchSprintBtn", "backToSprintBtn"]],
            ["Metrics", "/metrics", ["switchMetricsBtn"]],
            ["Team Notes", "/team-notes", ["switchTeamNotesBtn"]],
            ["Sprint History", "/sprint-history", ["sprintHistoryBtn"]]
        ];

        pages.forEach(([name, path, ids]) => {
            const existing = ids
                .map(id => document.getElementById(id))
                .find(Boolean);

            const link = existing || document.createElement("a");

            link.textContent = name;
            link.href = `${path}?project=${encodeURIComponent(projectId)}`;

            if (currentPage === path) {
                link.classList.add("active");
                link.setAttribute("aria-current", "page");
            }

            if (existing) {
                moveControl(existing, projectNav);
            } else {
                projectNav.appendChild(link);
            }
        });
    }

    // Page-specific actions
    const actionButtons = [
        "openCreateProject",
        "openCreateModal",
        "newNoteBtn",
        "exportJsonBtn",
        "importJsonBtn",
        "exportPdfBtn",
        "completeSprintBtn"
    ];

    actionButtons.forEach(id => {
        const action = document.getElementById(id);

        if (action) {
            moveControl(action, actions);
        }
    });

    if (actions.children.length > 0) {
        actions.insertAdjacentHTML(
            "afterbegin",
            "<hr><h4>Page Actions</h4>"
        );
    }

    // Hide old empty button containers
    oldContainers.forEach(container => {
        const remaining = [...container.children].filter(
            child => !child.classList.contains("hidden")
                     && !child.hidden
        );

        if (remaining.length === 0) {
            container.style.display = "none";
        }
    });

    // Open and close menu
    function setMenu(open) {
        menu.hidden = !open;
        button.innerHTML = open
        ? '<i data-lucide="x"></i>'
        : '<i data-lucide="menu"></i>';

        window.lucide?.createIcons();
        button.setAttribute("aria-expanded", open);
    }

    button.addEventListener("click", (event) => {
        event.stopPropagation();
        setMenu(menu.hidden);
    });

    menu.addEventListener("click", event => {
        if (event.target.closest("a, button:not(:disabled)")) {
            setMenu(false);
        }
    });

    document.addEventListener("click", event => {
        if (!nav.contains(event.target)) {
            setMenu(false);
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !menu.hidden) {
            setMenu(false);
            button.focus();
        }
    });

    // Navigation icons
const navIcons = {
    "Home": "house",
    "My Products": "folder-open",
    "About": "info",
    "Product Backlog": "list",
    "Sprint Backlog": "layers",
    "Metrics": "chart-no-axes-column",
    "Team Notes": "notebook-pen",
    "Sprint History": "history",
    "Create Product": "folder-plus",
    "Create User Story": "plus",
    "Export JSON": "download",
    "Import JSON": "upload",
    "Export PDF": "download",
    "Complete Sprint": "circle-check",
    "+ Create Note": "notebook-pen"
};

menu.querySelectorAll("a, button").forEach(item => {
    const label = item.textContent.trim();
    const icon = navIcons[label];

    if (icon) {
        item.insertAdjacentHTML(
            "afterbegin",
            `<i data-lucide="${icon}" aria-hidden="true"></i>`
        );
    }
});

// Desktop header navigation
const desktopNav = document.createElement("nav");
desktopNav.className = "desktop-nav";
desktopNav.setAttribute("aria-label", "Quick navigation");

nav.after(desktopNav);

const shortcuts = projectId
    ? [
        ...projectNav.querySelectorAll("a"),
        ...actions.querySelectorAll("button")
    ]
    : [
        ...menu.querySelectorAll("a"),
        ...actions.querySelectorAll("button")
    ];

shortcuts.forEach(original => {
    const shortcut = original.cloneNode(true);

    shortcut.removeAttribute("id");
    shortcut.className = "header-shortcut";

    if (original.classList.contains("active")) {
        shortcut.classList.add("active");
    }

    desktopNav.appendChild(shortcut);

    if (original.tagName === "BUTTON") {
        shortcut.type = "button";

        shortcut.addEventListener("click", () => {
            original.click();
        });
    }

    const sync = () => {
        if (original.tagName === "BUTTON") {
            shortcut.disabled = original.disabled;
        }

        if (original.tagName === "A") {
            shortcut.href = original.href;
        }

        shortcut.hidden =
            original.hidden ||
            original.classList.contains("hidden") ||
            original.style.display === "none";
    };

    sync();

    new MutationObserver(sync).observe(original, {
        attributes: true,
        attributeFilter: [
            "disabled",
            "href",
            "hidden",
            "class",
            "style"
        ]
    });
});

setMenu(false);
window.lucide?.createIcons();
})();