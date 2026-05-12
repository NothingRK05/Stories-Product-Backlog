import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from "./firebase.js";
import { showLoading, hideLoading } from "./loading.js";
import { showPopup } from "./popup.js";

const auth = getAuth(app);
const db   = getFirestore(app);

// DOM
const storyList          = document.getElementById("storyList");
const openCreateModalBtn = document.getElementById("openCreateModal");
const createModal        = document.getElementById("createModal");
const closeModalBtn      = document.getElementById("closeModalBtn");
const saveStoryBtn       = document.getElementById("saveStoryBtn");
const priorityInput      = document.getElementById("priorityInput");
const estimateInput      = document.getElementById("estimateInput");
const assignmentInput    = document.getElementById("assignmentInput");
const descriptionInput   = document.getElementById("descriptionInput");
const spikeInput         = document.getElementById("spikeInput");
const statusInput        = document.getElementById("statusInput");
const deleteModal        = document.getElementById("deleteModal");
const confirmDeleteBtn   = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn    = document.getElementById("cancelDeleteBtn");

// State
let projectId     = null;
let storyToEdit   = null;
let storyToDelete = null;
let cachedStories = [];
let currentSort   = "id";
let currentDir    = "asc";

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "/login"; return; }

  projectId = new URLSearchParams(window.location.search).get("project");
  if (!projectId) { showPopup("Error", "No project specified."); return; }

  await loadStories();
});

// Populate assignment dropdown from project owner + sharedWithNames
async function loadAssignmentOptions() {
  const projectSnap = await getDoc(doc(db, "projects", projectId));
  if (!projectSnap.exists()) return;

  const project = projectSnap.data();
  assignmentInput.innerHTML = "";

  const ownerName = project.owner || "Owner";
  assignmentInput.innerHTML += `<option value="${ownerName}">${ownerName}</option>`;

  const sharedWithNames = project.sharedWithNames || {};
  Object.values(sharedWithNames).forEach(name => {
    assignmentInput.innerHTML += `<option value="${name}">${name}</option>`;
  });

  assignmentInput.innerHTML += `<option value="Unassigned">Unassigned</option>`;
}

async function loadStories() {
  showLoading();

  const snap = await getDocs(collection(db, "projects", projectId, "product-backlog"));
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
    if (currentSort === "priority") result = (a.priority || 0) - (b.priority || 0);
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
  sortedStories().forEach(story => addStoryRow(story.id, story));
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

function addStoryRow(id, story) {
  const tr = document.createElement("tr");
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
        <div class="story-menu-icon" data-id="${id}">⋮</div>
        <div class="story-menu hidden" id="menu-${id}">
          <div class="story-menu-item" data-action="edit" data-id="${id}">Edit</div>
          <div class="story-menu-item" data-action="move" data-id="${id}">Move to Sprint Backlog</div>
          <div class="story-menu-item" data-action="delete" data-id="${id}">Delete</div>
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
  e.stopPropagation();
  document.querySelectorAll(".story-menu").forEach(m => m.classList.add("hidden"));

  const { action, id } = e.target.dataset;
  if (action === "edit")   openEditModal(id);
  if (action === "move")   await moveToSprintBacklog(id);
  if (action === "delete") openDeleteModal(id);
});

async function moveToSprintBacklog(storyId) {
  const ref = doc(db, "projects", projectId, "product-backlog", storyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  await addDoc(collection(db, "projects", projectId, "sprint-backlog"), snap.data());
  await deleteDoc(ref);
  await loadStories();
}

// Delete modal
function openDeleteModal(storyId) {
  storyToDelete = storyId;
  deleteModal.classList.remove("hidden");
}

confirmDeleteBtn.onclick = async () => {
  if (!storyToDelete) return;
  await deleteDoc(doc(db, "projects", projectId, "product-backlog", storyToDelete));
  storyToDelete = null;
  deleteModal.classList.add("hidden");
  await loadStories();
};

cancelDeleteBtn.onclick = () => {
  storyToDelete = null;
  deleteModal.classList.add("hidden");
};

// Create modal
openCreateModalBtn.onclick = async () => {
  storyToEdit = null;
  priorityInput.value = "";
  estimateInput.value = "";
  descriptionInput.value = "";
  spikeInput.value = "No";
  statusInput.value = "Not Ready";
  await loadAssignmentOptions();
  assignmentInput.value = "Unassigned";
  createModal.classList.remove("hidden");
};

closeModalBtn.onclick = () => createModal.classList.add("hidden");

saveStoryBtn.onclick = async () => {
  const priority    = Number(priorityInput.value || 0);
  const estimate    = Number(estimateInput.value || 0);
  const assigned    = assignmentInput.value.trim() || "Unassigned";
  const description = descriptionInput.value.trim();
  const spike       = spikeInput.value;
  const status      = statusInput.value;

  if (!description) {
    showPopup("Missing Description", "Please enter a description for the user story.");
    return;
  }

  if (priority < 1 || priority > 10) {
    showPopup("Invalid Priority", "Priority must be between 1 and 10.");
    return;
  }

  if (estimate < 0) {
    showPopup("Invalid Estimate", "Estimate cannot be negative.");
    return;
  }

  // Edit mode
  if (storyToEdit) {
    await updateDoc(doc(db, "projects", projectId, "product-backlog", storyToEdit), {
      priority, estimate, assigned, description, spike, status
    });
    storyToEdit = null;
    createModal.classList.add("hidden");
    await loadStories();
    return;
  }

  // Create mode — increment latestStoryId
  const projectRef  = doc(db, "projects", projectId);
  const projectSnap = await getDoc(projectRef);
  const nextId = (projectSnap.exists() ? projectSnap.data().latestStoryId || 0 : 0) + 1;

  await updateDoc(projectRef, { latestStoryId: nextId });
  await addDoc(collection(db, "projects", projectId, "product-backlog"), {
    numericId: nextId, priority, estimate, assigned, description, spike, status
  });

  createModal.classList.add("hidden");
  await loadStories();
};

// Edit modal — pre-fill form with existing story data
async function openEditModal(storyId) {
  const snap = await getDoc(doc(db, "projects", projectId, "product-backlog", storyId));
  if (!snap.exists()) return;

  const s = snap.data();
  storyToEdit = storyId;

  await loadAssignmentOptions();
  priorityInput.value    = s.priority ?? "";
  estimateInput.value    = s.estimate ?? "";
  descriptionInput.value = s.description ?? "";
  spikeInput.value       = s.spike ?? "No";
  statusInput.value      = s.status ?? "Not Ready";
  assignmentInput.value  = s.assigned ?? "Unassigned";

  createModal.classList.remove("hidden");
}
