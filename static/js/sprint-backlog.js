import { auth, db } from "../js/firebase.js";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showLoading, hideLoading } from "./loading.js";

const storyList         = document.getElementById("storyList");
const completeSprintBtn = document.getElementById("completeSprintBtn");

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
  const toggleLabel = story.status === "Ready" ? "Not Ready" : "Ready";

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

// Toggle story between Ready / Not Ready
async function toggleReadyState(storyId) {
  const ref = doc(db, "projects", projectId, "sprint-backlog", storyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const newStatus = snap.data().status === "Ready" ? "Not Ready" : "Ready";
  await updateDoc(ref, { status: newStatus });
  await loadStories();
}

// Complete sprint — delete Ready stories, return Not Ready to product backlog
completeSprintBtn.onclick = async () => {
  showLoading();

  const snap = await getDocs(collection(db, "projects", projectId, "sprint-backlog"));

  for (const d of snap.docs) {
    if (d.id === "_placeholder") continue;
    const story = d.data();
    const ref = doc(db, "projects", projectId, "sprint-backlog", d.id);

    if (story.status !== "Ready") {
      await addDoc(collection(db, "projects", projectId, "product-backlog"), story);
    }

    await deleteDoc(ref);
  }

  hideLoading();
  await loadStories();
};
