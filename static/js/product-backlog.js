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
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showLoading, hideLoading } from "./loading.js";

// ---------------------------------------------------------
// URL + DOM
// ---------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const projectId = params.get("project");

if (!projectId) console.error("❌ No projectId in URL");

let currentUserUid = null;
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
// BASE PATH
// ---------------------------------------------------------
function basePath() {
  return `projects/${projectId}`;
}

// ---------------------------------------------------------
// AUTH
// ---------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user || !projectId) return;

  currentUserUid = user.uid;

  if (!hasLoaded) {
    hasLoaded = true;
    loadStories();
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
  if (!storyToDelete) return;

  await deleteDoc(doc(db, `${basePath()}/product-backlog/${storyToDelete}`));

  deleteModal.classList.add("hidden");
  storyToDelete = null;
  loadStories();
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
    saveStory();
  };
}

// ---------------------------------------------------------
// NEXT STORY ID
// ---------------------------------------------------------
async function getNextStoryId() {
  const projectRef = doc(db, `projects/${projectId}`);
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
async function saveStory() {
  const storyId = await getNextStoryId();

  const ref = doc(db, `${basePath()}/product-backlog/${storyId}`);

  await setDoc(ref, {
    storyId,
    priority: priorityInput.value,
    estimate: estimateInput.value,
    assignment: assignmentInput.value,
    description: descriptionInput.value,
    spike: spikeInput.value,
    status: statusInput.value,
    createdAt: Date.now(),
    updatedBy: currentUserUid
  });

  modal.classList.add("hidden");
  loadStories();
}

// ---------------------------------------------------------
// LOAD STORIES
// ---------------------------------------------------------
async function loadStories() {
  showLoading();
  storyList.innerHTML = "";

  const q = query(
    collection(db, `${basePath()}/product-backlog`),
    orderBy("storyId")
  );

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
async function moveStoryToSprintBacklog(storyId) {
  const sourceRef = doc(db, `${basePath()}/product-backlog/${storyId}`);
  const targetRef = doc(db, `${basePath()}/sprint-backlog/${storyId}`);

  const snap = await getDoc(sourceRef);
  if (!snap.exists()) return;

  const data = snap.data();

  await setDoc(targetRef, {
    ...data,
    movedAt: Date.now(),
    movedBy: currentUserUid
  });

  await deleteDoc(sourceRef);

  loadStories();
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
  const ref = doc(db, `${basePath()}/product-backlog/${storyId}`);
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
      updatedAt: Date.now(),
      updatedBy: currentUserUid
    });

    modal.classList.add("hidden");
    loadStories();
  };

  modal.classList.remove("hidden");
});

// Move
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("move-item")) return;

  const storyId = e.target.dataset.id;
  await moveStoryToSprintBacklog(storyId);
});

// ---------------------------------------------------------
// SORTING
// ---------------------------------------------------------
let currentSort = null;

document.getElementById("sortBtn").addEventListener("click", () => {
  document.getElementById("sortMenu").classList.toggle("hidden");
});

document.querySelectorAll("#sortMenu div").forEach(option => {
  option.addEventListener("click", () => {
    currentSort = option.dataset.sort;
    sortStories();
    document.getElementById("sortMenu").classList.add("hidden");
  });
});

function sortStories() {
  const rows = Array.from(storyList.querySelectorAll("tr"));

  const sorted = rows.sort((rowA, rowB) => {
    const get = (row, index) => row.children[index].innerText.trim();

    switch (currentSort) {
      case "id":
        return get(rowA, 0).localeCompare(get(rowB, 0));

      case "priority":
        return Number(get(rowB, 2)) - Number(get(rowA, 2));

      case "estimate":
        return Number(get(rowA, 3)) - Number(get(rowB, 3));

      case "spike":
        const aSpike = get(rowA, 4) === "Yes" ? 1 : 0;
        const bSpike = get(rowB, 4) === "Yes" ? 1 : 0;
        return bSpike - aSpike;

      case "status":
        return get(rowA, 5).localeCompare(get(rowB, 5));

      case "assigned":
        return get(rowA, 6).localeCompare(get(rowB, 6));

      default:
        return 0;
    }
  });

  storyList.innerHTML = "";
  sorted.forEach(r => storyList.appendChild(r));
}