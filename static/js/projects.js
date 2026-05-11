import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

const projectList = document.getElementById("projectList");
const loadingOverlay = document.getElementById("loadingOverlay");

const createModal = document.getElementById("createProjectModal");
const deleteModal = document.getElementById("deleteProjectModal");

const projectNameInput = document.getElementById("projectNameInput");

let projectToDelete = null;

function showLoading() {
  loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
}

onAuthStateChanged(auth, user => {
  if (!user || hasLoaded) return;
  hasLoaded = true;
  loadProjects(user.uid);
});

async function loadProjects(uid) {
  showLoading();
  projectList.innerHTML = "";

  const q = collection(db, `users/${uid}/projects`);
  const snapshot = await getDocs(q);

  snapshot.forEach(docSnap => {
    const p = docSnap.data();
    const id = docSnap.id;

    const div = document.createElement("div");
    div.className = "info-box project-card";
    div.style.cursor = "pointer";

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>${p.name}</h3>
        <button class="delete-project-btn" data-id="${id}" style="
          background:#d9534f;
          border:none;
          color:white;
          padding:8px 14px;
          border-radius:6px;
          cursor:pointer;
          font-weight:bold;
        ">Delete</button>
      </div>
    `;

    div.addEventListener("click", () => {
      window.location.href = `/product-backlog?project=${id}`;
    });

    div.querySelector(".delete-project-btn").addEventListener("click", e => {
      e.stopPropagation();
      projectToDelete = id;
      deleteModal.classList.remove("hidden");
    });

    projectList.appendChild(div);
  });

  hideLoading();
}

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

    showPopup("Project Created", `"${name}" has been added with fresh product and sprint backlogs.`);

    createModal.classList.add("hidden");
    loadProjects(user.uid);
  } catch (err) {
    console.error(err);
    showPopup("Error", "Something went wrong while creating the project.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Create";
  }
};

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
  loadProjects(user.uid);
};

function showPopup(title, message) {
  const popup = document.getElementById("customPopup");
  document.getElementById("popupTitle").textContent = title;
  document.getElementById("popupMessage").textContent = message;

  popup.classList.remove("hidden");

  document.getElementById("popupCloseBtn").onclick = () => {
    popup.classList.add("hidden");
  };
}