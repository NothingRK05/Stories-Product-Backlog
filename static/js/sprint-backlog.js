import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy 
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

const params = new URLSearchParams(window.location.search);
const projectId = params.get("project");

if (!projectId) {
  console.error("❌ No projectId found in URL. Sprint backlog cannot load.");
}

onAuthStateChanged(auth, user => {
  if (user && !hasLoaded && projectId) {
    hasLoaded = true;
    loadSprintStories(user.uid, projectId);
  }
});

const tbody = document.getElementById("storyList");
const deleteModal = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

let storyToDelete = null;

cancelDeleteBtn.onclick = () => {
  storyToDelete = null;
  deleteModal.classList.add("hidden");
};

confirmDeleteBtn.onclick = async () => {
  if (!storyToDelete) return;
  const user = auth.currentUser;

  const base = `users/${user.uid}/projects/${projectId}`;
  await deleteDoc(doc(db, `${base}/sprint-backlog/${storyToDelete}`));

  deleteModal.classList.add("hidden");
  storyToDelete = null;
  loadSprintStories(user.uid, projectId);
};

async function loadSprintStories(uid, projectId) {
  tbody.innerHTML = "";

  const base = `users/${uid}/projects/${projectId}`;
  const q = query(collection(db, `${base}/sprint-backlog`), orderBy("storyId"));
  const snapshot = await getDocs(q);

  snapshot.forEach(docSnap => {
    const s = docSnap.data();

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
        <div class="menu-dropdown">
          <div class="menu-item mark-ready" data-id="${s.storyId}">Mark As Ready</div>
          <div class="menu-item delete-item" data-id="${s.storyId}">Delete</div>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

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
  if (e.target.classList.contains("mark-ready")) {
    const storyId = e.target.dataset.id;
    const user = auth.currentUser;

    const base = `users/${user.uid}/projects/${projectId}`;
    const ref = doc(db, `${base}/sprint-backlog/${storyId}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();

    await setDoc(ref, {
      ...data,
      status: "Ready",
      updatedAt: Date.now()
    });

    loadSprintStories(user.uid, projectId);
  }
});