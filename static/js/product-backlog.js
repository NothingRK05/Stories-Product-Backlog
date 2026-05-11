import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { app } from "./firebase.js";

const auth = getAuth(app);
const db = getFirestore(app);

/* ============================================================
   DOM ELEMENTS
   ============================================================ */

const storyList = document.getElementById("storyList");

const openCreateModalBtn = document.getElementById("openCreateModal");
const createModal = document.getElementById("createModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const saveStoryBtn = document.getElementById("saveStoryBtn");

const priorityInput = document.getElementById("priorityInput");
const estimateInput = document.getElementById("estimateInput");
const assignmentInput = document.getElementById("assignmentInput");
const descriptionInput = document.getElementById("descriptionInput");
const spikeInput = document.getElementById("spikeInput");
const statusInput = document.getElementById("statusInput");

const deleteModal = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

const customPopup = document.getElementById("customPopup");
const popupTitleEl = document.getElementById("popupTitle");
const popupMessageEl = document.getElementById("popupMessage");
const popupCloseBtn = document.getElementById("popupCloseBtn");

const sortBtn = document.getElementById("sortBtn");
const sortMenu = document.getElementById("sortMenu");

/* ============================================================
   STATE
   ============================================================ */

let projectId = null;
let currentUser = null;
let storyToEdit = null;
let storyToDelete = null;
let currentSort = "id";

/* ============================================================
   POPUP HELPER
   ============================================================ */

function showPopup(title, message) {
  popupTitleEl.textContent = title;
  popupMessageEl.textContent = message;
  customPopup.classList.remove("hidden");

  popupCloseBtn.onclick = () => {
    customPopup.classList.add("hidden");
  };
}

/* ============================================================
   INIT
   ============================================================ */

function getProjectIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("project");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  currentUser = user;
  projectId = getProjectIdFromUrl();

  if (!projectId) {
    showPopup("Error", "No project specified.");
    return;
  }

  await loadStories();
});

/* ============================================================
   LOAD ASSIGNMENT OPTIONS
   ============================================================ */

async function loadAssignmentOptions() {
  const projectRef = doc(db, "projects", projectId);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) return;

  const project = projectSnap.data();
  const ownerUid = project.ownerUid;
  const sharedWith = project.sharedWith || [];

  assignmentInput.innerHTML = "";

  // Owner
  let ownerName = "Owner";
  if (ownerUid) {
    const ownerRef = doc(db, "users", ownerUid);
    const ownerSnap = await getDoc(ownerRef);
    if (ownerSnap.exists()) {
      ownerName = ownerSnap.data().displayName || "Owner";
    }
  }

  assignmentInput.innerHTML += `<option value="${ownerName}">${ownerName}</option>`;

  // Shared users
  for (const uid of sharedWith) {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) continue;

    const name = userSnap.data().displayName || "User";
    assignmentInput.innerHTML += `<option value="${name}">${name}</option>`;
  }

  assignmentInput.innerHTML += `<option value="">Unassigned</option>`;
}

/* ============================================================
   LOAD STORIES
   ============================================================ */

async function loadStories() {
  storyList.innerHTML = "";

  const colRef = collection(db, "projects", projectId, "product-backlog");
  const snap = await getDocs(colRef);

  let stories = [];
  snap.forEach((d) => {
    if (d.id !== "_placeholder") {
      stories.push({ id: d.id, ...d.data() });
    }
  });

  // Sorting
  stories.sort((a, b) => {
    if (currentSort === "priority") return (a.priority || 0) - (b.priority || 0);
    if (currentSort === "estimate") return (a.estimate || 0) - (b.estimate || 0);
    if (currentSort === "status") return (a.status || "").localeCompare(b.status || "");
    if (currentSort === "assigned") return (a.assigned || "").localeCompare(b.assigned || "");
    if (currentSort === "spike") return (a.spike || "").localeCompare(b.spike || "");
    return (a.numericId || 0) - (b.numericId || 0);
  });

  stories.forEach((story) => addStoryRow(story.id, story));
}

/* ============================================================
   RENDER STORY ROW (WITH 3 DOTS)
   ============================================================ */

function addStoryRow(id, story) {
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td>${story.numericId || ""}</td>
    <td>${story.description || ""}</td>
    <td>${story.priority || ""}</td>
    <td>${story.estimate || ""}</td>
    <td>${story.spike || ""}</td>
    <td>${story.status || ""}</td>
    <td>${story.assigned || "Unassigned"}</td>

    <td class="story-actions-cell">
      <div class="story-menu-wrapper">
        <div class="story-menu-icon" data-id="${id}">⋮</div>

        <div class="story-menu hidden" id="menu-${id}">
          <div class="story-menu-item" data-action="edit" data-id="${id}">
            Edit
          </div>
          <div class="story-menu-item" data-action="move" data-id="${id}">
            Move to Sprint Backlog
          </div>
          <div class="story-menu-item" data-action="delete" data-id="${id}">
            Delete
          </div>
        </div>
      </div>
    </td>
  `;

  storyList.appendChild(tr);
}

/* ============================================================
   3 DOTS MENU
   ============================================================ */

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("story-menu-icon")) {
    const id = e.target.dataset.id;
    const menu = document.getElementById(`menu-${id}`);
    menu.classList.toggle("hidden");
    return;
  }

  document.querySelectorAll(".story-menu").forEach((m) => {
    if (!m.contains(e.target)) m.classList.add("hidden");
  });
});

/* ============================================================
   MENU ACTIONS
   ============================================================ */

document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("story-menu-item")) return;

  const action = e.target.dataset.action;
  const id = e.target.dataset.id;

  if (action === "edit") {
    openEditModal(id);
  }

  if (action === "move") {
    await moveToSprintBacklog(id);
  }

  if (action === "delete") {
    openDeleteModal(id);
  }
});

/* ============================================================
   MOVE TO SPRINT BACKLOG
   ============================================================ */

async function moveToSprintBacklog(storyId) {
  const ref = doc(db, "projects", projectId, "product-backlog", storyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const story = snap.data();

  await addDoc(collection(db, "projects", projectId, "sprint-backlog"), story);
  await deleteDoc(ref);

  loadStories();
}

/* ============================================================
   DELETE STORY
   ============================================================ */

function openDeleteModal(storyId) {
  document.querySelectorAll(".story-menu").forEach(m => m.classList.add("hidden"));
  storyToDelete = storyId;
  deleteModal.classList.remove("hidden");
}

confirmDeleteBtn.onclick = async () => {
  if (!storyToDelete) return;

  const ref = doc(db, "projects", projectId, "product-backlog", storyToDelete);
  await deleteDoc(ref);

  storyToDelete = null;
  deleteModal.classList.add("hidden");
  loadStories();
};

cancelDeleteBtn.onclick = () => {
  deleteModal.classList.add("hidden");
  storyToDelete = null;
};

/* ============================================================
   CREATE / EDIT STORY
   ============================================================ */

openCreateModalBtn.onclick = async () => {


  storyToEdit = null;

  priorityInput.value = "";
  estimateInput.value = "";
  descriptionInput.value = "";
  spikeInput.value = "No";
  statusInput.value = "Not Ready";

  await loadAssignmentOptions();
  assignmentInput.value = "";

  createModal.classList.remove("hidden");
};

closeModalBtn.onclick = () => {
  createModal.classList.add("hidden");
};

saveStoryBtn.onclick = async () => {
  const priority = Number(priorityInput.value || 0);
  const estimate = Number(estimateInput.value || 0);
  const assigned = assignmentInput.value.trim();
  const description = descriptionInput.value.trim();
  const spike = spikeInput.value;
  const status = statusInput.value;

  if (!description) return;

  const colRef = collection(db, "projects", projectId, "product-backlog");

  // EDIT MODE
  if (storyToEdit) {
    const storyRef = doc(db, "projects", projectId, "product-backlog", storyToEdit);
    await updateDoc(storyRef, {
      priority,
      estimate,
      assigned,
      description,
      spike,
      status
    });

    createModal.classList.add("hidden");
    storyToEdit = null;
    loadStories();
    return;
  }

  // CREATE MODE
  const projectRef = doc(db, "projects", projectId);
  const projectSnap = await getDoc(projectRef);

  let nextId = 1;
  if (projectSnap.exists()) {
    nextId = (projectSnap.data().latestStoryId || 0) + 1;
  }

  await updateDoc(projectRef, { latestStoryId: nextId });

  await addDoc(colRef, {
    numericId: nextId,
    priority,
    estimate,
    assigned,
    description,
    spike,
    status
  });

  createModal.classList.add("hidden");
  loadStories();
};

/* ============================================================
   EDIT STORY MODAL
   ============================================================ */

async function openEditModal(storyId) {
  document.querySelectorAll(".story-menu").forEach(m => m.classList.add("hidden"));
  const ref = doc(db, "projects", projectId, "product-backlog", storyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const s = snap.data();
  storyToEdit = storyId;

  await loadAssignmentOptions();

  priorityInput.value = s.priority ?? "";
  estimateInput.value = s.estimate ?? "";
  assignmentInput.value = s.assigned ?? "";
  descriptionInput.value = s.description ?? "";
  spikeInput.value = s.spike ?? "No";
  statusInput.value = s.status ?? "Not Ready";

  createModal.classList.remove("hidden");
}

/* ============================================================
   SORTING
   ============================================================ */

sortBtn.onclick = () => {
  sortMenu.classList.toggle("hidden");
};

sortMenu.addEventListener("click", (e) => {
  const sort = e.target.dataset.sort;
  if (!sort) return;

  currentSort = sort;
  sortMenu.classList.add("hidden");
  loadStories();
});