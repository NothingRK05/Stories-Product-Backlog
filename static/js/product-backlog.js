import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword 
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

//signInWithEmailAndPassword(auth, "rktest2156@gmail.com", "LightningMcQueen21");

let hasLoaded = false;

onAuthStateChanged(auth, user => {
  if (user && !hasLoaded) {
    hasLoaded = true;
    loadStories(user.uid);
  }
});

const storyList = document.getElementById("storyList");
const modal = document.getElementById("createModal");

document.getElementById("openCreateModal").onclick = () => {
  resetModal();
  modal.classList.remove("hidden");
};

document.getElementById("closeModalBtn").onclick = () => modal.classList.add("hidden");

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
  await deleteDoc(doc(db, `users/${user.uid}/product-backlog/${storyToDelete}`));
  deleteModal.classList.add("hidden");
  storyToDelete = null;
  loadStories(user.uid);
};

function resetModal() {
  document.querySelector(".story-modal h3").textContent = "Create User Story";
  document.getElementById("priorityInput").value = "";
  document.getElementById("estimateInput").value = "";
  document.getElementById("assignmentInput").value = "";
  document.getElementById("descriptionInput").value = "";
  document.getElementById("spikeInput").value = "No";
  document.getElementById("statusInput").value = "Not Ready";

  document.getElementById("saveStoryBtn").onclick = () => {
    const user = auth.currentUser;
    if (user) saveStory(user.uid);
  };
}

async function getNextStoryId(uid) {
  const userRef = doc(db, `users/${uid}`);
  const snap = await getDoc(userRef);

  let next = 1;

  if (snap.exists() && snap.data().latestStoryId) {
    next = Number(snap.data().latestStoryId) + 1;
  }

  await setDoc(userRef, { latestStoryId: next }, { merge: true });

  return next.toString().padStart(4, "0");
}

async function saveStory(uid) {
  const priority = document.getElementById("priorityInput").value;
  const estimate = document.getElementById("estimateInput").value;
  const assignment = document.getElementById("assignmentInput").value;
  const description = document.getElementById("descriptionInput").value;
  const spike = document.getElementById("spikeInput").value;
  const status = document.getElementById("statusInput").value;

  const storyId = await getNextStoryId(uid);

  await setDoc(doc(db, `users/${uid}/product-backlog/${storyId}`), {
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
  loadStories(uid);
}

  async function loadStories(uid) {
    const tbody = document.getElementById("storyList");
    tbody.innerHTML = "";

    const q = query(collection(db, `users/${uid}/product-backlog`), orderBy("storyId"));
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
          <div class="menu-dropdown hidden">
            <div class="menu-item edit-item" data-id="${s.storyId}">Edit</div>
            <div class="menu-item move-item" data-id="${s.storyId}">Move to Sprint Backlog</div>
            <div class="menu-item delete-item" data-id="${s.storyId}">Delete</div>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

async function moveStoryToSprintBacklog(uid, storyId) {
  const sourceRef = doc(db, `users/${uid}/product-backlog/${storyId}`);
  const targetRef = doc(db, `users/${uid}/sprint-backlog/${storyId}`);

  const snap = await getDoc(sourceRef);
  if (!snap.exists()) return;

  const data = snap.data();

  // 1. Write to sprint backlog
  await setDoc(targetRef, {
    ...data,
    movedAt: Date.now()
  });

  // 2. Remove from product backlog
  await deleteDoc(sourceRef);

  // 3. Refresh UI
  loadStories(uid);
}


  document.addEventListener("click", e => {
    if (!e.target.classList.contains("menu-btn")) {
      document.querySelectorAll(".menu-dropdown").forEach(m => m.classList.remove("show"));
      return;
    }

    const dropdown = e.target.nextElementSibling;
    dropdown.classList.toggle("show");
  });


document.addEventListener("click", async e => {
  if (e.target.classList.contains("delete-item")) {
    storyToDelete = e.target.dataset.id;
    deleteModal.classList.remove("hidden");
  }
});

document.addEventListener("click", async e => {
  if (e.target.classList.contains("edit-item")) {
    const storyId = e.target.dataset.id;
    const user = auth.currentUser;

    const docRef = doc(db, `users/${user.uid}/product-backlog/${storyId}`);
    const snap = await getDoc(docRef);
    const s = snap.data();

    document.getElementById("priorityInput").value = s.priority;
    document.getElementById("estimateInput").value = s.estimate;
    document.getElementById("assignmentInput").value = s.assignment;
    document.getElementById("descriptionInput").value = s.description;
    document.getElementById("spikeInput").value = s.spike;
    document.getElementById("statusInput").value = s.status;

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
      loadStories(user.uid);
    };

    modal.classList.remove("hidden");
  }
});

document.addEventListener("click", async e => {
  if (e.target.classList.contains("move-item")) {
    const storyId = e.target.dataset.id;
    const user = auth.currentUser;

    await moveStoryToSprintBacklog(user.uid, storyId);
  }
});

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
  const rows = Array.from(tbody.querySelectorAll("tr"));

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

  tbody.innerHTML = "";
  sorted.forEach(r => tbody.appendChild(r));
}
