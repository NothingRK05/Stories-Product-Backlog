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
const completeSprintBtn = document.getElementById("completeSprintBtn");

const sortBtn = document.getElementById("sortBtn");
const sortMenu = document.getElementById("sortMenu");

const params = new URLSearchParams(window.location.search);
const projectId = params.get("project");

let currentUid = null;
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

  const colRef = collection(db, "projects", projectId, "sprint-backlog");
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

  const toggleLabel = story.status === "Ready" ? "Not Ready" : "Ready";

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
          <div class="story-menu-item" data-action="toggle" data-id="${story.id}">
            ${toggleLabel}
          </div>
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

  if (action === "toggle") {
    await toggleReadyState(id);
  }
});

/* ============================================================
   TOGGLE READY / NOT READY
   ============================================================ */

async function toggleReadyState(storyId) {
  const ref = doc(db, "projects", projectId, "sprint-backlog", storyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const current = snap.data().status || "Not Ready";
  const newStatus = current === "Ready" ? "Not Ready" : "Ready";

  await updateDoc(ref, { status: newStatus });

  loadStories();
}

/* ============================================================
   COMPLETE SPRINT
   ============================================================ */

completeSprintBtn.onclick = async () => {
  showLoading();

  const sprintRef = collection(db, "projects", projectId, "sprint-backlog");
  const snap = await getDocs(sprintRef);

  for (const d of snap.docs) {
    if (d.id === "_placeholder") continue;

    const story = d.data();

    if (story.status === "Ready") {
      await deleteDoc(doc(db, "projects", projectId, "sprint-backlog", d.id));
    } else {
      await addDoc(
        collection(db, "projects", projectId, "product-backlog"),
        story
      );

      await deleteDoc(doc(db, "projects", projectId, "sprint-backlog", d.id));
    }
  }

  hideLoading();
  loadStories();
};

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