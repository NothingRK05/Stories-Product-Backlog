import { app, auth, db } from "./firebase.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { sendShareRequest } from "./sharing.js";

/* ---------------------------------------------------------
   DOM ELEMENTS
--------------------------------------------------------- */
let hasLoaded = false;

const projectList = document.getElementById("projectList");
const loadingOverlay = document.getElementById("loadingOverlay");

const createModal = document.getElementById("createProjectModal");
const deleteModal = document.getElementById("deleteProjectModal");
const shareModal = document.getElementById("shareProjectModal");

const projectNameInput = document.getElementById("projectNameInput");
const shareEmailInput = document.getElementById("shareEmailInput");

let projectToDelete = null;
let projectToShare = null;
let projectToShareName = null;

/* ---------------------------------------------------------
   LOADING OVERLAY
--------------------------------------------------------- */
function showLoading() {
  loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
}

/* ---------------------------------------------------------
   AUTH STATE
--------------------------------------------------------- */
onAuthStateChanged(auth, user => {
  if (!user || hasLoaded) return;
  hasLoaded = true;
  loadUnifiedProjectList(user.uid);
});

/* ---------------------------------------------------------
   LOAD OWNED + SHARED PROJECTS
--------------------------------------------------------- */
async function loadUnifiedProjectList(uid) {
  showLoading();
  projectList.innerHTML = "";

  const allProjects = [];

  // Own projects
  const ownSnap = await getDocs(collection(db, `users/${uid}/projects`));
  ownSnap.forEach(docSnap => {
    const p = docSnap.data();
    const id = docSnap.id;
    if (id === "_init") return;

    allProjects.push({
      id,
      name: p.name,
      owner: uid,
      ownerName: null,
      isShared: false
    });
  });

  const sharedSnap = await getDocs(collection(db, `users/${uid}/shared-projects`));
  for (const docSnap of sharedSnap.docs) {
    const p = docSnap.data();
    const id = docSnap.id;

    const ownerRef = doc(db, `users/${p.owner}`);
    const ownerSnap = await getDoc(ownerRef);
    const ownerName = ownerSnap.exists() ? ownerSnap.data().displayName : "Unknown";

    allProjects.push({
      id,
      name: p.projectName,
      owner: p.owner,
      ownerName,
      isShared: true
    });
  }

  // Render
  allProjects.forEach(project => {
    const div = document.createElement("div");
    div.className = "info-box project-card";
    div.style.cursor = "pointer";

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>${project.name}</h3>
        ${
          project.isShared
            ? `<span style="color:#8f7bff; font-weight:bold;">Shared by: ${project.ownerName}</span>`
            : `
              <div style="display:flex; gap:10px;">
                <button class="share-project-btn" data-id="${project.id}" data-name="${project.name}" style="
                  background:#6a5acd;
                  border:none;
                  color:white;
                  padding:8px 14px;
                  border-radius:6px;
                  cursor:pointer;
                  font-weight:bold;
                ">Share</button>

                <button class="delete-project-btn" data-id="${project.id}" style="
                  background:#d9534f;
                  border:none;
                  color:white;
                  padding:8px 14px;
                  border-radius:6px;
                  cursor:pointer;
                  font-weight:bold;
                ">Delete</button>
              </div>
            `
        }
      </div>
    `;

    // Open project
    div.addEventListener("click", () => {
      window.location.href = `/product-backlog?project=${project.id}`;
    });

    // Delete
    if (!project.isShared) {
      div.querySelector(".delete-project-btn").addEventListener("click", e => {
        e.stopPropagation();
        projectToDelete = project.id;
        deleteModal.classList.remove("hidden");
      });
    }

    // Share
    if (!project.isShared) {
      div.querySelector(".share-project-btn").addEventListener("click", e => {
        e.stopPropagation();
        projectToShare = project.id;
        projectToShareName = project.name;
        shareEmailInput.value = "";
        shareModal.classList.remove("hidden");
      });
    }

    projectList.appendChild(div);
  });

  hideLoading();
}

/* ---------------------------------------------------------
   CREATE PROJECT
--------------------------------------------------------- */
document.getElementById("openCreateProject").onclick = () => {
  projectNameInput.value = "";
  createModal.classList.remove("hidden");
};

document.getElementById("closeProjectModal").onclick = () => {
  createModal.classList.add("hidden");
};

document.getElementById("saveProjectBtn").onclick = async () => {
  const btn = document.getElementById("saveProjectBtn");
  btn.disabled = true;
  btn.textContent = "Creating...";

  const name = projectNameInput.value.trim();
  if (!name) {
    showPopup("Missing Name", "Please enter a project name.");
    btn.disabled = false;
    btn.textContent = "Create";
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    showPopup("Error", "You must be logged in to create a project.");
    btn.disabled = false;
    btn.textContent = "Create";
    return;
  }

  try {
    const projectsRef = collection(db, `users/${user.uid}/projects`);
    const snapshot = await getDocs(projectsRef);

    let nameExists = false;
    snapshot.forEach(docSnap => {
      const p = docSnap.data();
      if (p.name.toLowerCase() === name.toLowerCase()) {
        nameExists = true;
      }
    });

    if (nameExists) {
      showPopup("Duplicate Project", "A project with that name already exists.");
      btn.disabled = false;
      btn.textContent = "Create";
      return;
    }

    const projectRef = doc(projectsRef);
    await setDoc(projectRef, {
      name,
      latestStoryId: 0,
      createdAt: Date.now()
    });

    const projectId = projectRef.id;
    const basePath = `users/${user.uid}/projects/${projectId}`;

    await setDoc(
      doc(db, `${basePath}/product-backlog/_init`),
      { placeholder: true, createdAt: Date.now() }
    );

    await setDoc(
      doc(db, `${basePath}/sprint-backlog/_init`),
      { placeholder: true, createdAt: Date.now() }
    );

    showPopup("Project Created", `"${name}" has been added.`);

    createModal.classList.add("hidden");
    loadUnifiedProjectList(user.uid);
  } catch (err) {
    console.error(err);
    showPopup("Error", "Something went wrong while creating the project.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Create";
  }
};

/* ---------------------------------------------------------
   DELETE PROJECT
--------------------------------------------------------- */
document.getElementById("cancelDeleteProject").onclick = () => {
  projectToDelete = null;
  deleteModal.classList.add("hidden");
};

document.getElementById("confirmDeleteProject").onclick = async () => {
  if (!projectToDelete) return;

  const user = auth.currentUser;
  if (!user) return;

  await deleteDoc(doc(db, `users/${user.uid}/projects/${projectToDelete}`));

  deleteModal.classList.add("hidden");
  projectToDelete = null;
  loadUnifiedProjectList(user.uid);
};

/* ---------------------------------------------------------
   SHARE PROJECT
--------------------------------------------------------- */
document.getElementById("cancelShareBtn").onclick = () => {
  projectToShare = null;
  projectToShareName = null;
  shareModal.classList.add("hidden");
};

document.getElementById("confirmShareBtn").onclick = async () => {
  const inputRaw = shareEmailInput.value.trim();
  const input = inputRaw.toLowerCase();

  if (!input) {
    showPopup("Missing Input", "Enter a username or email.");
    return;
  }

  const user = auth.currentUser;
  if (!user) return;

  const usersSnap = await getDocs(collection(db, "users"));

  let targetUid = null;

  usersSnap.forEach(docSnap => {
    const u = docSnap.data();
    const uid = docSnap.id;

    const userEmail = u.email?.toLowerCase();
    const userName = u.displayName?.toLowerCase();

    if (userEmail === input || userName === input) {
      targetUid = uid;
    }
  });

  if (!targetUid) {
    showPopup("User Not Found", "No user exists with that username or email.");
    return;
  }

  if (targetUid === user.uid) {
    showPopup("Invalid", "You cannot share a project with yourself.");
    return;
  }

  await sendShareRequest(targetUid, projectToShare, projectToShareName);

  showPopup("Request Sent", `Your share request for "${projectToShareName}" has been sent.`);

  shareModal.classList.add("hidden");
};

/* ---------------------------------------------------------
   POPUP
--------------------------------------------------------- */
function showPopup(title, message) {
  const popup = document.getElementById("customPopup");
  document.getElementById("popupTitle").textContent = title;
  document.getElementById("popupMessage").textContent = message;

  popup.classList.remove("hidden");

  document.getElementById("popupCloseBtn").onclick = () => {
    popup.classList.add("hidden");
  };
}