import { auth, db } from "../js/firebase.js";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
  writeBatch,
  serverTimestamp,
  query,
}
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showLoading, hideLoading } from "./loading.js";

const storyList         = document.getElementById("storyList");
const completeSprintBtn = document.getElementById("completeSprintBtn");
const projectNameDisplay = document.getElementById("projectName");
const exportPdfBtn      = document.getElementById("exportPdfBtn");
const totalStoriesDisplay = document.getElementById("totalStories");
const totalStoryPointsDisplay = document.getElementById("totalStoryPoints");

const projectId = new URLSearchParams(window.location.search).get("project");

let currentUid    = null;
let cachedStories = [];
let currentSort   = "id";
let currentDir    = "asc";

// Auth check — verify user has access to this project
onAuthStateChanged(auth, async (user) => {
  if (!user || !projectId) return;
  currentUid = user.uid;

  const projectSnap = await getDoc(doc(db, "projects", projectId));
  if (!projectSnap.exists()) {
    alert("Project not found.");
    window.location.href = "/projects";
    return;
  }

  const project = projectSnap.data();
  const hasAccess = project.ownerUid === currentUid ||
                    (project.sharedWith || []).includes(currentUid);

  if (!hasAccess) {
    alert("You do not have access to this project.");
    window.location.href = "/projects";
    return;
  }
    // Display the current project name
    projectNameDisplay.textContent = project.projectName || "Team Workspace";

  await loadStories();
});

async function loadStories() {
  showLoading();

  const snap = await getDocs(collection(db, "projects", projectId, "sprint-backlog"));
  cachedStories = snap.docs
    .filter(d => d.id !== "_placeholder")
    .map(d => ({ id: d.id, ...d.data() }));

  renderStories();
  hideLoading();
}

function sortedStories() {
  const dir = currentDir === "asc" ? 1 : -1;
  return [...cachedStories].sort((a, b) => {
    let result = 0;
    if (currentSort === "priority")      result = (a.priority || 0) - (b.priority || 0);
    else if (currentSort === "estimate") result = (a.estimate || 0) - (b.estimate || 0);
    else if (currentSort === "status")   result = (a.status || "").localeCompare(b.status || "");
    else if (currentSort === "assigned") result = (a.assigned || "").localeCompare(b.assigned || "");
    else if (currentSort === "spike")    result = (a.spike || "").localeCompare(b.spike || "");
    else result = (a.numericId || 0) - (b.numericId || 0);
    return result * dir;
  });
}

function renderStories() {
  storyList.innerHTML = "";
  sortedStories().forEach(addStoryRow);
  updateHeaderIndicators();
  updateBacklogTotals();
}

// Update Sprint Backlog totals
function updateBacklogTotals() {
  const totalStories = cachedStories.length;

  const totalStoryPoints = cachedStories.reduce(
    (total, story) => total + (Number(story.estimate) || 0),
    0
  );

  totalStoriesDisplay.textContent = totalStories;
  totalStoryPointsDisplay.textContent = totalStoryPoints;
}

function updateHeaderIndicators() {
  document.querySelectorAll(".story-table th[data-sort]").forEach(th => {
    const arrow = th.querySelector(".sort-arrow");
    if (!arrow) return;
    if (th.dataset.sort === currentSort) {
      arrow.textContent = currentDir === "asc" ? " ↑" : " ↓";
      th.classList.add("th-active");
    } else {
      arrow.textContent = "";
      th.classList.remove("th-active");
    }
  });
}

function addStoryRow(story) {
  const tr = document.createElement("tr");
  const toggleLabel = story.status === "Done" ? "Not Done" : "Done";

  tr.innerHTML = `
    <td>${story.numericId || ""}</td>
    <td>${story.description || ""}</td>
    <td>${story.priority || ""}</td>
    <td>${story.estimate ?? ""}</td>
    <td>${story.spike || ""}</td>
    <td>${story.status || ""}</td>
    <td>${story.assigned || "Unassigned"}</td>
    <td class="story-actions-cell">
      <div class="story-menu-wrapper">
        <div class="story-menu-icon" data-id="${story.id}">⋮</div>
        <div class="story-menu hidden" id="menu-${story.id}">
          <div class="story-menu-item" data-action="toggle" data-id="${story.id}">${toggleLabel}</div>
        </div>
      </div>
    </td>
  `;

  storyList.appendChild(tr);
}

// Header click sorting
document.addEventListener("click", (e) => {
  const th = e.target.closest("th[data-sort]");
  if (!th) return;
  const sort = th.dataset.sort;
  if (sort === currentSort) {
    currentDir = currentDir === "asc" ? "desc" : "asc";
  } else {
    currentSort = sort;
    currentDir = "asc";
  }
  renderStories();
});

// Open/close 3-dots menus
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("story-menu-icon")) {
    const id = e.target.dataset.id;
    document.querySelectorAll(".story-menu").forEach(m => {
      m.classList.toggle("hidden", m.id !== `menu-${id}`);
    });
    return;
  }
  document.querySelectorAll(".story-menu").forEach(m => {
    if (!m.contains(e.target)) m.classList.add("hidden");
  });
});

// Handle menu item clicks
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("story-menu-item")) return;
  const { action, id } = e.target.dataset;
  if (action === "toggle") await toggleReadyState(id);
});

// Toggle story between Done / Not Done
async function toggleReadyState(storyId) {
  const ref = doc(db, "projects", projectId, "sprint-backlog", storyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const newStatus = snap.data().status === "Done" ? "Not Done" : "Done";
  await updateDoc(ref, { status: newStatus });
  await loadStories();
}

// Complete sprint — delete Ready stories, return Not Ready to product backlog
let sprintStoriesCache = [];

completeSprintBtn.onclick = async () => {
  showLoading();

  const snap = await getDocs(collection(db, "projects", projectId, "sprint-backlog"));
  sprintStoriesCache = snap.docs
    .filter(d => d.id !== "_placeholder")
    .map(d => ({ id: d.id, ...d.data() }));

  const returning = sprintStoriesCache.filter(s => s.status !== "Done");
  const deleting = sprintStoriesCache.filter(s => s.status === "Done");

  // Populate returning list
  const backlogList = document.getElementById("backlogList");
  const backlogCount = document.getElementById("backlogCount");
  backlogList.innerHTML = returning.length
    ? returning.map(s => `<li>#${s.numericId} — ${s.description || "No description"}</li>`).join("")
    : "<li style='color:#777'>None</li>";
  backlogCount.textContent = returning.length;

  // Populate deleting list
  const deleteList = document.getElementById("deleteList");
  const deleteCount = document.getElementById("deleteCount");
  deleteList.innerHTML = deleting.length
    ? deleting.map(s => `<li>#${s.numericId} — ${s.description || "No description"}</li>`).join("")
    : "<li style='color:#777'>None</li>";
  deleteCount.textContent = deleting.length;

  hideLoading();
  document.getElementById("completeSprintModal").classList.remove("hidden");
};

document.getElementById("cancelCompleteSprintBtn").onclick = () => {
  document.getElementById("completeSprintModal").classList.add("hidden");
  sprintStoriesCache = [];
};

document.getElementById("confirmCompleteSprintBtn").onclick = async () => {
  showLoading();
  document.getElementById("completeSprintModal").classList.add("hidden");

  // Separate completed and unfinished stories
  const completedStories = sprintStoriesCache.filter(
    story => story.status === "Done"
  );

  // Use one batch so archiving and moving stories happen together
  const batch = writeBatch(db);

  // Save completed stories to the Sprint Archive
  if (completedStories.length > 0) {
    const archiveRef = doc(
      collection(db, "projects", projectId, "sprint-archives")
    );

    batch.set(archiveRef, {
      completedAt: serverTimestamp(),
      completedBy: currentUid,
      totalStories: completedStories.length,
      totalStoryPoints: completedStories.reduce(
        (total, story) => total + (Number(story.estimate) || 0),
        0
      ),
      stories: completedStories
    });
  }

  // Return unfinished stories to the product backlog
  // and remove all stories from the active sprint
  for (const story of sprintStoriesCache) {
    const sprintRef = doc(
      db, "projects", projectId, "sprint-backlog", story.id
    );

    if (story.status !== "Done") {
      const { id, ...storyData } = story;

      const productRef = doc(
        collection(db, "projects", projectId, "product-backlog")
      );

      batch.set(productRef, storyData);
    }

    batch.delete(sprintRef);
  }

  // Commit all the changes together
  await batch.commit();


  // Reset all member metrics
  const projectSnap = await getDoc(doc(db, "projects", projectId));
  if (projectSnap.exists()) {
    const project = projectSnap.data();
    const members = [project.owner, ...Object.values(project.sharedWithNames || {})];

    for (const name of members) {
      if (!name) continue;
      await setDoc(doc(db, "projects", projectId, "metrics", `member_${name}`), {
        estimatedCapacity: 0,
        hoursWorked: 0
      }, { merge: true });
    }
  }

  // Clear signatures
  await deleteDoc(doc(db, "projects", projectId, "metrics", "preSignatures"));
  await deleteDoc(doc(db, "projects", projectId, "metrics", "postSignatures"));

  sprintStoriesCache = [];
  hideLoading();
  await loadStories();
};

// ── Export PDF ──────────────────────────────────────────────────
// Downloads every story currently in the sprint backlog as a PDF.

exportPdfBtn.onclick = async () => {
  if (!cachedStories.length) {
    alert("The sprint backlog is empty.");
    return;
  }

  // Get the jsPDF library
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  // Get project name
  const projectSnap = await getDoc(doc(db, "projects", projectId));
  const projectName = projectSnap.exists()
    ? projectSnap.data().projectName || "Project"
    : "Project";

  // PDF heading
  pdf.setFontSize(20);
  pdf.text("Sprint Backlog", 14, 20);

  pdf.setFontSize(12);
  pdf.text(`Project: ${projectName}`, 14, 30);
  pdf.text(`Date: ${new Date().toLocaleDateString()}`, 14, 37);

  // Table data
  const rows = sortedStories().map(story => [
    story.numericId || "",
    story.description || "",
    story.priority || "",
    story.estimate ?? "",
    story.spike || "",
    story.status || "",
    story.assigned || "Unassigned"
  ]);

  // Create PDF table
  pdf.autoTable({
    startY: 45,
    head: [[
      "ID",
      "User Story / Task",
      "Priority",
      "Story\nPoints",
      "Spike",
      "Status",
      "Assigned"
    ]],
    body: rows,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: "linebreak"
    },
    headStyles: {
      fillColor: [106, 90, 205]
    },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 65 },
      2: { cellWidth: 17 },
      3: { cellWidth: 17 },
      4: { cellWidth: 15 },
      5: { cellWidth: 20 },
      6: { cellWidth: 35 }
    },
    margin: { left: 14, right: 14 }
  });

  // Download PDF
  pdf.save(`sprint-backlog-${projectName.replace(/[^a-z0-9]/gi, "-")}.pdf`);
};

 // ── Sprint History ───────────────────────────────────────

const sprintHistoryBtn = document.getElementById("sprintHistoryBtn");
const sprintHistorySection = document.getElementById("sprintHistorySection");
const sprintHistoryList = document.getElementById("sprintHistoryList");

// Show or hide sprint history
sprintHistoryBtn.onclick = async () => {
  const isHidden = sprintHistorySection.classList.contains("hidden");

  sprintHistorySection.classList.toggle("hidden");

  if (isHidden) {
    await loadSprintHistory();
    sprintHistorySection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
};

// Retrieve completed sprints from Firebase
async function loadSprintHistory() {
  sprintHistoryList.textContent = "Loading sprint history...";

  if (!currentUid || !projectId) {
    sprintHistoryList.textContent = "Please sign in to view sprint history.";
    return;
  }

  try {
    const archiveRef = collection(
      db,
      "projects",
      projectId,
      "sprint-archives"
    );

    const snapshot = await getDocs(archiveRef);

    const archives = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    // Most recent sprint first
    archives.sort((a, b) => {
      const dateA = a.completedAt?.toMillis?.() || 0;
      const dateB = b.completedAt?.toMillis?.() || 0;
      return dateB - dateA;
    });

    sprintHistoryList.replaceChildren();

    if (archives.length === 0) {
      sprintHistoryList.textContent =
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
        margin-bottom: 15px;
      `;

      const date = archive.completedAt?.toDate
        ? archive.completedAt.toDate().toLocaleString()
        : "Date unavailable";

      const heading = document.createElement("summary");
      heading.style.cssText = `
        cursor: pointer;
        font-weight: 600;
        color: var(--purple-light, #8877ff);
      `;

      heading.textContent =
        `Archived Sprint ${archives.length - index} — ${date}`;

      card.appendChild(heading);

      const stats = document.createElement("p");
      stats.style.margin = "15px 0";
      stats.textContent =
        `${archive.totalStories || 0} completed stories | ` +
        `${archive.totalStoryPoints || 0} story points`;

      card.appendChild(stats);

      const table = document.createElement("table");
      table.className = "story-table";
      table.style.width = "100%";

      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");

      ["ID", "User Story / Task", "Status", "Points", "Assigned"]
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
          story.status ?? "Done",
          story.estimate ?? "",
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
      sprintHistoryList.appendChild(card);
    });

  } catch (error) {
    console.error("Sprint history error:", error);
    sprintHistoryList.textContent =
      "Unable to load sprint history. Check Firebase permissions.";
  }
}

