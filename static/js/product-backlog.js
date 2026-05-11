import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getAuth, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getProjectOwner } from "../js/sharing.js";

const firebaseConfig = {
  apiKey: "AIzaSyDcWb980e-FXMugxnx6jE1CZB3WrVFw4-4",
  authDomain: "stories-dec4a.firebaseapp.com",
  databaseURL: "https://stories-dec4a-default-rtdb.firebaseio.com",
  projectId: "stories-dec4a",
  storageBucket: "stories-dec4a.firebasestorage.app",
  messagingSenderId: "95187761797",
  appId: "1:95187761797:web:bf377dc3852526bf7187ec",
  measurementId: "G-7PBGNCC6K9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let hasLoaded = false;
let ownerUid = null;

const params = new URLSearchParams(window.location.search);
const projectId = params.get("project");

if (!projectId) {
  console.error("❌ No projectId found in URL. Product backlog cannot load.");
}

const storyList = document.getElementById("storyList");
const modal = document.getElementById("createModal");

const deleteModal = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

let storyToDelete = null;

const priorityInput = document.getElementById("priorityInput");
const estimateInput = document.getElementById("estimateInput");
const assignmentInput = document.getElementById("assignmentInput");
const descriptionInput = document.getElementById("descriptionInput");
const spikeInput = document.getElementById("spikeInput");
const statusInput = document.getElementById("statusInput");

/* ---------------------------------------------------------
   AUTH + PERMISSION CHECK
--------------------------------------------------------- */
onAuthStateChanged(auth, async user => {
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

/* ---------------------------------------------------------
   MODAL HANDLERS
--------------------------------------------------------- */
document.getElementById("openCreateModal").onclick = () => {
  resetModal();
  modal.classList.remove("hidden");
};

document.getElementById("closeModalBtn").onclick = () => modal.classList.add("hidden");

cancelDeleteBtn.onclick = () => {
  storyToDelete = null;
  deleteModal.classList.add("hidden");
};

confirmDeleteBtn.onclick = async () => {
  if (!storyToDelete || !ownerUid) return;

  const base = `users/${ownerUid}/projects/${projectId}`;
  await deleteDoc(doc(db, `${base}/product-backlog/${storyToDelete}`));

  deleteModal.classList.add("hidden");
  storyToDelete = null;
  loadStories(ownerUid, projectId);
};

function resetModal() {
  document.querySelector(".story-modal h3").textContent = "Create User Story";
  priorityInput.value = "";
  estimateInput.value = "";
  assignmentInput.value = "";
  descriptionInput.value = "";
  spikeInput.value = "No";
  statusInput.value = "Not Ready";

  document.getElementById("saveStoryBtn").onclick = () => {
    if (ownerUid && projectId) saveStory(ownerUid, projectId);
  };
}

/* ---------------------------------------------------------
   ID GENERATION
--------------------------------------------------------- */
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

/* ---------------------------------------------------------
   SAVE STORY
--------------------------------------------------------- */
async function saveStory(uid, projectId) {
  const priority = priorityInput.value;
  const estimate = estimateInput.value;
  const assignment = assignmentInput.value;
  const description = descriptionInput.value;
  const spike = spikeInput.value;
  const status = statusInput.value;

  const storyId = await getNextStoryId(uid, projectId);

  const base = `users/${uid}/projects/${projectId}`;

  await setDoc(doc(db, `${base}/product-backlog/${storyId}`), {
    storyId,
    priority,
    estimate,
    assignment,
    description,
    spike,
    status,
    createdAt: Date.now()
  });

  modal.classList.add("hidden");
  loadStories(uid, projectId);
}

/* ---------------------------------------------------------
   LOAD STORIES
--------------------------------------------------------- */
async function loadStories(uid, projectId) {
  storyList.innerHTML = "";

  const base = `users/${uid}/projects/${projectId}`;
  const q = query(collection(db, `${base}/product-backlog`), orderBy("storyId"));
  const snapshot = await getDocs(q);

  snapshot.forEach(docSnap => {
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
}

/* ---------------------------------------------------------
   MOVE TO SPRINT BACKLOG
--------------------------------------------------------- */
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

/* ---------------------------------------------------------
   MENU + ACTION HANDLERS
--------------------------------------------------------- */
document.addEventListener("click", e => {
  if (!e.target.classList.contains("menu-btn")) {
    document.querySelectorAll(".menu-dropdown").forEach(m => m.classList.remove("show"));
    return;
  }

  const dropdown = e.target.nextElementSibling;
  dropdown.classList.toggle("show");
});

document.addEventListener("click", e => {
  if (e.target.classList.contains("delete-item")) {
    storyToDelete = e.target.dataset.id;
    deleteModal.classList.remove("hidden");
  }
});

document.addEventListener("click", async e => {
  if (e.target.classList.contains("edit-item")) {
    if (!ownerUid) return;

    const storyId = e.target.dataset.id;

    const base = `users/${ownerUid}/projects/${projectId}`;
    const docRef = doc(db, `${base}/product-backlog/${storyId}`);
    const snap = await getDoc(docRef);
    const s = snap.data();

    priorityInput.value = s.priority;
    estimateInput.value = s.estimate;
    assignmentInput.value = s.assignment;
    descriptionInput.value = s.description;
    spikeInput.value = s.spike;
    statusInput.value = s.status;

    document.querySelector(".story-modal h3").textContent = "Edit User Story";

    document.getElementById("saveStoryBtn").onclick = async () => {
      await setDoc(docRef, {
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
  }
});

document.addEventListener("click", async e => {
  if (e.target.classList.contains("move-item")) {
    if (!ownerUid) return;

    const storyId = e.target.dataset.id;
    await moveStoryToSprintBacklog(ownerUid, projectId, storyId);
  }
});