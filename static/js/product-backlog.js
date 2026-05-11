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

const storyList = document.getElementById("storyList");
const createModal = document.getElementById("createModal");
const deleteModal = document.getElementById("deleteModal");

const priorityInput = document.getElementById("priorityInput");
const estimateInput = document.getElementById("estimateInput");
const assignmentInput = document.getElementById("assignmentInput");
const descriptionInput = document.getElementById("descriptionInput");
const spikeInput = document.getElementById("spikeInput");
const statusInput = document.getElementById("statusInput");

const openCreateModalBtn = document.getElementById("openCreateModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const saveStoryBtn = document.getElementById("saveStoryBtn");

const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

const sortBtn = document.getElementById("sortBtn");
const sortMenu = document.getElementById("sortMenu");

const params = new URLSearchParams(window.location.search);
const projectId = params.get("project");

let currentUid = null;
let storyToDelete = null;
let storyToEdit = null;
let currentSort = "id";

/* ============================================================
   AUTH + ACCESS CHECK
   ============================================================ */

onAuthStateChanged(auth, async (user) => {
  if (!user || !projectId) return;
  currentUid = user.uid;

  const projectRef = doc(db, "projects", projectId);
  const projectSnap = await getDoc(projectRef);

  if (!projectSnap.exists()) {
    alert("Project not found.");
    window.location.href = "/projects";
    return;
  }

  const project = projectSnap.data();

  if (project.ownerUid !== currentUid &&
      !(project.sharedWith || []).includes(currentUid)) {
    alert("You do not have access to this project.");
    window.location.href = "/projects";
    return;
  }

  await loadStories();
});

/* ============================================================
   LOAD STORIES
   ============================================================ */

async function loadStories() {
  showLoading();
  storyList.innerHTML = "";

  const colRef = collection(db, "projects", projectId, "product-backlog");
  const snap = await getDocs(colRef);

  const stories = [];
  snap.forEach((d) => {
    if (d.id !== "_placeholder") {
      stories.push({ id: d.id, ...d.data() });
    }
  });

  stories.sort((a, b) => {
    if (currentSort === "priority") return (a.priority || 0) - (b.priority || 0);
    if (currentSort === "estimate") return (a.estimate || 0) - (b.estimate || 0);
    if (currentSort === "status") return (a.status || "").localeCompare(b.status || "");
    if (currentSort === "assigned") return (a.assigned || "").localeCompare(b.assigned || "");
    if (currentSort === "spike") return (a.spike || "").localeCompare(b.spike || "");
    return (a.numericId || 0) - (b.numericId || 0);
  });

  stories.forEach(addStoryRow);
  hideLoading();
}

/* ============================================================
   RENDER ROW
   ============================================================ */

function addStoryRow(story) {
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td>${story.numericId || ""}</td>
    <td>${story.description || ""}</td>
    <td>${story.priority || ""}</td>
    <td>${story.estimate || ""}</td>
    <td>${story.spike || ""}</td>
    <td>${story.status || ""}</td>
    <td>${story.assigned || ""}</td>

    <td class="story-actions-cell">
      <div class="story-menu-wrapper">
        <div class="story-menu-icon" data-id="${story.id}">⋮</div>

        <div class="story-menu hidden" id="menu-${story.id}">
          <div class="story-menu-item" data-action="edit" data-id="${story.id}">Edit</div>
          <div class="story-menu-item" data-action="move" data-id="${story.id}">Move to Sprint Backlog</div>
          <div class="story-menu-item" data-action="delete" data-id="${story.id}">Delete</div>
        </div>
      </div>
    </td>
  `;

  storyList.appendChild(tr);
}

/* ============================================================
   3-DOTS MENU
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
    document.querySelectorAll(".story-menu").forEach(m => m.classList.add("hidden"));
    openEditModal(id);
  }

  if (action === "move") {
    await moveStoryToSprint(id);
  }

  if (action === "delete") {
    document.querySelectorAll(".story-menu").forEach(m => m.classList.add("hidden"));
    storyToDelete = id;
    deleteModal.classList.remove("hidden");
  }
});

/* ============================================================
   DELETE STORY
   ============================================================ */

confirmDeleteBtn.onclick = async () => {
  if (!storyToDelete) return;

  await deleteDoc(doc(db, "projects", projectId, "product-backlog", storyToDelete));

  deleteModal.classList.add("hidden");
  storyToDelete = null;
  loadStories();
};

cancelDeleteBtn.onclick = () => {
  storyToDelete = null;
  deleteModal.classList.add("hidden");
};

/* ============================================================
   CREATE / EDIT STORY
   ============================================================ */

openCreateModalBtn.onclick = () => {
  storyToEdit = null;
  priorityInput.value = "";
  estimateInput.value = "";
  assignmentInput.value = "";
  descriptionInput.value = "";
  spikeInput.value = "No";
  statusInput.value = "Not Ready";
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
    await updateDoc(doc(db, "projects", projectId, "product-backlog", storyToEdit), {
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
  const ref = doc(db, "projects", projectId, "product-backlog", storyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const s = snap.data();

  storyToEdit = storyId;

  priorityInput.value = s.priority || "";
  estimateInput.value = s.estimate || "";
  assignmentInput.value = s.assigned || "";
  descriptionInput.value = s.description || "";
  spikeInput.value = s.spike || "No";
  statusInput.value = s.status || "Not Ready";

  createModal.classList.remove("hidden");
}

/* ============================================================
   MOVE TO SPRINT BACKLOG
   ============================================================ */

async function moveStoryToSprint(storyId) {
  const ref = doc(db, "projects", projectId, "product-backlog", storyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const story = snap.data();

  await addDoc(collection(db, "projects", projectId, "sprint-backlog"), story);

  await deleteDoc(ref);

  loadStories();
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