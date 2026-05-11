import { auth, db } from "../js/firebase.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getProjectOwner } from "../js/sharing.js";
import { showLoading, hideLoading } from "./loading.js";

// ---------------------------------------------------------
// URL + DOM
// ---------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const projectId = params.get("project");

if (!projectId) {
  console.error("❌ No projectId in URL");
}

let ownerUid = null;
let hasLoaded = false;

const storyList = document.getElementById("storyList");
const modal = document.getElementById("createModal");
const deleteModal = document.getElementById("deleteModal");

const priorityInput = document.getElementById("priorityInput");
const estimateInput = document.getElementById("estimateInput");
const assignmentInput = document.getElementById("assignmentInput");
const descriptionInput = document.getElementById("descriptionInput");
const spikeInput = document.getElementById("spikeInput");
const statusInput = document.getElementById("statusInput");

let storyToDelete = null;

// ---------------------------------------------------------
// AUTH + PERMISSION CHECK
// ---------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user || !projectId) return;

  ownerUid = await getProjectOwner(projectId, user.uid);

  if (!ownerUid) {
    alert("You do not have permission to access this project.");
    window.location.href = "/projects";
    return;
  }

  if (!hasLoaded) {
    hasLoaded = true;
    loadStories(ownerUid, projectId);
  }
});

// ---------------------------------------------------------
// MODAL HANDLERS
// ---------------------------------------------------------
document.getElementById("openCreateModal").onclick = () => {
  resetModal();
  modal.classList.remove("hidden");
};

document.getElementById("closeModalBtn").onclick = () => {
  modal.classList.add("hidden");
};

document.getElementById("cancelDeleteBtn").onclick = () => {
  storyToDelete = null;
  deleteModal.classList.add("hidden");
};

document.getElementById("confirmDeleteBtn").onclick = async () => {
  if (!storyToDelete || !ownerUid) return;

  const base = `users/${ownerUid}/projects/${projectId}`;
  await deleteDoc(doc(db, `${base}/product-backlog/${storyToDelete}`));

  deleteModal.classList.add("hidden");
  storyToDelete = null;
  loadStories(ownerUid, projectId);
};

// ---------------------------------------------------------
// RESET MODAL
// ---------------------------------------------------------
function resetModal() {
  document.querySelector(".story-modal h3").textContent = "Create User Story";

  priorityInput.value = "";
  estimateInput.value = "";
  assignmentInput.value = "";
  descriptionInput.value = "";
  spikeInput.value = "No";
  statusInput.value = "Not Ready";

  document.getElementById("saveStoryBtn").onclick = () => {
    saveStory(ownerUid, projectId);
  };
}

// ---------------------------------------------------------
// NEXT STORY ID
// ---------------------------------------------------------
async function getNextStoryId(uid, projectId) {
  const projectRef = doc(db, `users/${uid}/projects/${projectId}`);
  const snap = await getDoc(projectRef);

  let next = 1;

  if (snap.exists() && snap.data().latestStoryId) {
    next = Number(snap.data().latestStoryId) + 1;
  }

  await setDoc(projectRef, { latestStoryId: next }, { merge: true });

  return next.toString().padStart(4, "0");
}

// ---------------------------------------------------------
// SAVE STORY
// ---------------------------------------------------------
async function saveStory(uid, projectId) {
  const storyId = await getNextStoryId(uid, projectId);

  const base = `users/${uid}/projects/${projectId}`;
  const ref = doc(db, `${base}/product-backlog/${storyId}`);

  await setDoc(ref, {
    storyId,
    priority: priorityInput.value,
    estimate: estimateInput.value,
    assignment: assignmentInput.value,
    description: descriptionInput.value,
    spike: spikeInput.value,
    status: statusInput.value,
    createdAt: Date.now()
  });

  modal.classList.add("hidden");
  loadStories(uid, projectId);
}

// ---------------------------------------------------------
// LOAD STORIES
// ---------------------------------------------------------
async function loadStories(uid, projectId) {
  showLoading();
  
  storyList.innerHTML = "";

  const base = `users/${uid}/projects/${projectId}`;
  const q = query(collection(db, `${base}/product-backlog`), orderBy("storyId"));
  const snapshot = await getDocs(q);

  snapshot.forEach((docSnap) => {
    const s = docSnap.data();

    if (s.storyId === "_init") return;

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${s.storyId}</td>
      <td>${s.description}</td>
      <td>${s.priority}</td>
      <td>${s.estimate} hrs</td>
      <td>${s.spike}</td>
      <td>${s.status}</td>
      <td>${s.assignment}</td>
      <td style="position:relative; width:40px; text-align:right;">
        <button class="menu-btn" type="button">⋮</button>
        <div class="menu-dropdown hidden">
          <div class="menu-item edit-item" data-id="${s.storyId}">Edit</div>
          <div class="menu-item move-item" data-id="${s.storyId}">Move to Sprint Backlog</div>
          <div class="menu-item delete-item" data-id="${s.storyId}">Delete</div>
        </div>
      </td>
    `;

    storyList.appendChild(tr);
  });

  hideLoading();
}

// ---------------------------------------------------------
// MOVE STORY TO SPRINT BACKLOG
// ---------------------------------------------------------
async function moveStoryToSprintBacklog(uid, projectId, storyId) {
  const base = `users/${uid}/projects/${projectId}`;
  const sourceRef = doc(db, `${base}/product-backlog/${storyId}`);
  const targetRef = doc(db, `${base}/sprint-backlog/${storyId}`);

  const snap = await getDoc(sourceRef);
  if (!snap.exists()) return;

  const data = snap.data();

  await setDoc(targetRef, {
    ...data,
    movedAt: Date.now()
  });

  await deleteDoc(sourceRef);

  loadStories(uid, projectId);
}

// ---------------------------------------------------------
// MENU HANDLERS
// ---------------------------------------------------------
document.addEventListener("click", (e) => {
  if (!e.target.classList.contains("menu-btn")) {
    document.querySelectorAll(".menu-dropdown").forEach((m) => m.classList.remove("show"));
    return;
  }

  const dropdown = e.target.nextElementSibling;
  dropdown.classList.toggle("show");
});

// Delete
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete-item")) {
    storyToDelete = e.target.dataset.id;
    deleteModal.classList.remove("hidden");
  }
});

// Edit
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("edit-item")) return;

  const storyId = e.target.dataset.id;
  const base = `users/${ownerUid}/projects/${projectId}`;
  const ref = doc(db, `${base}/product-backlog/${storyId}`);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const s = snap.data();

  priorityInput.value = s.priority || "";
  estimateInput.value = s.estimate || "";
  assignmentInput.value = s.assignment || "";
  descriptionInput.value = s.description || "";
  spikeInput.value = s.spike || "No";
  statusInput.value = s.status || "Not Ready";

  document.querySelector(".story-modal h3").textContent = "Edit User Story";

  document.getElementById("saveStoryBtn").onclick = async () => {
    await setDoc(ref, {
      storyId,
      priority: priorityInput.value,
      estimate: estimateInput.value,
      assignment: assignmentInput.value,
      description: descriptionInput.value,
      spike: spikeInput.value,
      status: statusInput.value,
      updatedAt: Date.now()
    });

    modal.classList.add("hidden");
    loadStories(ownerUid, projectId);
  };

  modal.classList.remove("hidden");
});

// Move
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("move-item")) return;

  const storyId = e.target.dataset.id;
  await moveStoryToSprintBacklog(ownerUid, projectId, storyId);
});
