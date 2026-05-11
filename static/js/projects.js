import { auth, db } from "../js/firebase.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  currentUserUid = user.uid;
  await loadProjects();
});

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
    addProjectRow(docSnap.id, p.projectName, true);
  });

  const sharedSnap = await getDocs(
    collection(db, "users", currentUserUid, "shared-projects")
  );

  sharedSnap.forEach((docSnap) => {
    const p = docSnap.data();
    addProjectRow(docSnap.id, p.projectName, false);
  });

  hideLoading();
}

function addProjectRow(projectId, name, isOwner) {
  const div = document.createElement("div");
  div.classList.add("project-row");

  div.innerHTML = `
    <div class="project-name">${name}</div>
    <div class="project-type">${isOwner ? "Owner" : "Shared"}</div>
    <div class="project-actions">
      <button class="open-btn" data-id="${projectId}">Open</button>
      ${isOwner ? `
        <button class="share-btn" data-id="${projectId}">Share</button>
        <button class="delete-btn" data-id="${projectId}">Delete</button>
      ` : ""}
    </div>
  `;

  projectList.appendChild(div);
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("open-btn")) {
    const id = e.target.dataset.id;
    window.location.href = `/product-backlog?project=${id}`;
  }
});

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("share-btn")) {
    projectToShare = e.target.dataset.id;
    shareEmailInput.value = "";
    shareProjectModal.classList.remove("hidden");
  }
});

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

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete-btn")) {
    projectToDelete = e.target.dataset.id;
    deleteProjectModal.classList.remove("hidden");
  }
});

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
    sharedWith: []
  });

  createProjectModal.classList.add("hidden");
  loadProjects();
};