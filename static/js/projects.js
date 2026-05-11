import { auth, db } from "../js/firebase.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showPopup } from "./popup.js";
import { showLoading, hideLoading } from "./loading.js";
import { sendShareRequest } from "./sharing.js";
import { currentUserInfo } from "./auth-state.js";

const projectList = document.getElementById("projectList");

const createProjectModal = document.getElementById("createProjectModal");
const deleteProjectModal = document.getElementById("deleteProjectModal");
const shareProjectModal = document.getElementById("shareProjectModal");

const projectNameInput = document.getElementById("projectNameInput");
const shareEmailInput = document.getElementById("shareEmailInput");

const openCreateProjectBtn = document.getElementById("openCreateProject");
const saveProjectBtn = document.getElementById("saveProjectBtn");
const closeProjectModalBtn = document.getElementById("closeProjectModal");

const confirmDeleteProjectBtn = document.getElementById("confirmDeleteProject");
const cancelDeleteProjectBtn = document.getElementById("cancelDeleteProject");

const confirmShareBtn = document.getElementById("confirmShareBtn");
const cancelShareBtn = document.getElementById("cancelShareBtn");

let currentUserUid = null;
let projectToDelete = null;
let projectToShare = null;

/* ============================================================
   AUTH + LOAD PROJECTS
   ============================================================ */

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  currentUserUid = user.uid;
  await loadProjects();
});

/* ============================================================
   LOAD PROJECTS (OWNER + SHARED)
   ============================================================ */

async function loadProjects() {
  if (!currentUserUid) return;

  showLoading();
  projectList.innerHTML = "";

  const ownedQuery = query(
    collection(db, "projects"),
    where("ownerUid", "==", currentUserUid)
  );
  const ownedSnap = await getDocs(ownedQuery);

  ownedSnap.forEach((docSnap) => {
    const p = docSnap.data();
    addProjectCard(docSnap.id, p.projectName, true, p.owner);
  });

  const sharedQuery = query(
    collection(db, "projects"),
    where("sharedWith", "array-contains", currentUserUid)
  );
  const sharedSnap = await getDocs(sharedQuery);

  sharedSnap.forEach((docSnap) => {
    const p = docSnap.data();
    addProjectCard(docSnap.id, p.projectName, false, p.owner);
  });

  hideLoading();
}

/* ============================================================
   PROJECT CARD
   ============================================================ */

function addProjectCard(projectId, name, isOwner, ownerName) {
  const card = document.createElement("div");
  card.classList.add("project-card");

  const typeLabel = isOwner ? "Owner" : `Shared by: ${ownerName}`;

  card.innerHTML = `
    <div class="project-info">
      <h3 class="project-name">${name}</h3>
      <p class="project-type">${typeLabel}</p>
    </div>

    <div class="project-actions">
      ${isOwner ? `
        <button class="project-btn share">Share</button>
        <button class="project-btn delete">Delete</button>
      ` : `
        <button class="project-btn leave">Leave Project</button>
      `}
    </div>
  `;

  card.addEventListener("click", () => {
    window.location.href = `/product-backlog?project=${projectId}`;
  });

  const shareBtn = card.querySelector(".share");
  const deleteBtn = card.querySelector(".delete");

  if (shareBtn) {
    shareBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      projectToShare = projectId;
      shareEmailInput.value = "";
      shareProjectModal.classList.remove("hidden");
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      projectToDelete = projectId;
      deleteProjectModal.classList.remove("hidden");
    });
  }

  const leaveBtn = card.querySelector(".leave");
  if (leaveBtn) {
    leaveBtn.addEventListener("click", (e) => {
      e.stopPropagation();

      showPopup(
        "Leave Project?",
        "Are you sure you want to leave this project? You will lose access."
      );

      const closeBtn = document.getElementById("popupCloseBtn");
      closeBtn.onclick = async () => {
        document.getElementById("customPopup").classList.add("hidden");
        await leaveProject(projectId);
      };
    });
  }

  projectList.appendChild(card);
}

/* ============================================================
   LEAVE PROJECT
   ============================================================ */

async function leaveProject(projectId) {
  const user = auth.currentUser;
  if (!user) return;

  const projectRef = doc(db, "projects", projectId);

  await updateDoc(projectRef, {
    sharedWith: arrayRemove(user.uid)
  });

  window.location.href = "/projects";
}

/* ============================================================
   SHARE PROJECT
   ============================================================ */

cancelShareBtn.onclick = () => {
  projectToShare = null;
  shareProjectModal.classList.add("hidden");
};

confirmShareBtn.onclick = async () => {
  if (!projectToShare) return;
  const ident = shareEmailInput.value.trim();
  if (!ident) return;

  await sendShareRequest(projectToShare, ident);

  shareProjectModal.classList.add("hidden");
  projectToShare = null;
};

/* ============================================================
   DELETE PROJECT
   ============================================================ */

cancelDeleteProjectBtn.onclick = () => {
  projectToDelete = null;
  deleteProjectModal.classList.add("hidden");
};

confirmDeleteProjectBtn.onclick = async () => {
  if (!projectToDelete) return;

  await deleteDoc(doc(db, "projects", projectToDelete));

  deleteProjectModal.classList.add("hidden");
  projectToDelete = null;
  loadProjects();
};

/* ============================================================
   CREATE PROJECT
   ============================================================ */

openCreateProjectBtn.onclick = () => {
  projectNameInput.value = "";
  createProjectModal.classList.remove("hidden");
};

closeProjectModalBtn.onclick = () => {
  createProjectModal.classList.add("hidden");
};

saveProjectBtn.onclick = async () => {
  const name = projectNameInput.value.trim();
  if (!name || !currentUserInfo || !currentUserInfo.usernameLower) return;

  const user = auth.currentUser;
  if (!user) return;

  const usernameLower = currentUserInfo.usernameLower;

  const usernameRef = doc(db, "usernames", usernameLower);
  const usernameSnap = await getDoc(usernameRef);
  if (!usernameSnap.exists()) return;

  const displayName = usernameSnap.data().displayName || usernameLower;

  const newRef = doc(collection(db, "projects"));

  await setDoc(newRef, {
    projectName: name,
    owner: displayName,
    ownerUid: user.uid,
    ownerUsernameLower: usernameLower,
    latestStoryId: 0,
    sharedWith: []
  });

  await setDoc(doc(db, "projects", newRef.id, "product-backlog", "_placeholder"), {
    placeholder: true
  });

  await setDoc(doc(db, "projects", newRef.id, "sprint-backlog", "_placeholder"), {
    placeholder: true
  });

  createProjectModal.classList.add("hidden");
  loadProjects();
};