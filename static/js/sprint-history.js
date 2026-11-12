
import { auth, db } from "./firebase.js";

import {
  collection,
  doc,
  getDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const projectId = new URLSearchParams(window.location.search).get("project");

const historyList = document.getElementById("sprintHistoryList");
const projectNameDisplay = document.getElementById("projectName");

// Check authentication and project permissions
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    historyList.textContent = "Please sign in to view sprint history.";
    return;
  }

  if (!projectId) {
    historyList.textContent = "No project selected.";
    return;
  }

  try {
    const projectSnap = await getDoc(doc(db, "projects", projectId));

    if (!projectSnap.exists()) {
      historyList.textContent = "Project not found.";
      return;
    }

    const project = projectSnap.data();

    const hasAccess =
      project.ownerUid === user.uid ||
      (project.sharedWith || []).includes(user.uid);

    if (!hasAccess) {
      historyList.textContent = "You do not have access to this project.";
      return;
    }

    projectNameDisplay.textContent =
      project.projectName || "Team Workspace";

    await loadSprintHistory();

  } catch (error) {
    console.error("Project access error:", error);
    historyList.textContent = "Unable to load project.";
  }
});

// Retrieve archived sprints
async function loadSprintHistory() {
  historyList.textContent = "Loading sprint history...";

  try {
    const snapshot = await getDocs(
      collection(db, "projects", projectId, "sprint-archives")
    );

    const archives = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    archives.sort((a, b) =>
      (b.completedAt?.toMillis?.() || 0) -
      (a.completedAt?.toMillis?.() || 0)
    );

    historyList.replaceChildren();

    if (archives.length === 0) {
      historyList.textContent =
        "No completed sprints have been archived yet.";
      return;
    }

    archives.forEach((archive, index) => {
      const card = document.createElement("details");

      card.style.cssText = `
        background: var(--card-bg, #252530);
        border: 1px solid #7772;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 16px;
      `;

      const heading = document.createElement("summary");

      heading.style.cssText = `
        cursor: pointer;
        font-size: 18px;
        font-weight: 600;
        color: var(--purple-light, #8877ff);
      `;

      const date = archive.completedAt?.toDate
        ? archive.completedAt.toDate().toLocaleString()
        : "Date unavailable";

      heading.textContent =
        `Archived Sprint ${archives.length - index} — ${date}`;

      card.appendChild(heading);

      const stats = document.createElement("p");
      stats.style.margin = "20px 0";

      stats.textContent =
        `${archive.totalStories || 0} Completed Stories | ` +
        `${archive.totalStoryPoints || 0} Story Points`;

      card.appendChild(stats);

      const table = document.createElement("table");
      table.className = "story-table";
      table.style.width = "100%";

      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");

      ["ID", "User Story / Task", "Priority", "Points", "Status", "Assigned"]
        .forEach(label => {
          const th = document.createElement("th");
          th.textContent = label;
          headerRow.appendChild(th);
        });

      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");

      (archive.stories || []).forEach(story => {
        const tr = document.createElement("tr");

        [
          story.numericId ?? "",
          story.description ?? "",
          story.priority ?? "",
          story.estimate ?? "",
          story.status ?? "Done",
          story.assigned ?? "Unassigned"
        ].forEach(value => {
          const td = document.createElement("td");
          td.textContent = String(value);
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      card.appendChild(table);
      historyList.appendChild(card);
    });

  } catch (error) {
    console.error("Sprint history error:", error);
    historyList.textContent =
      "Unable to load sprint history. Check Firebase permissions.";
  }
}
