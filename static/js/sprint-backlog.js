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
import { hideLoading, showLoading } from "./loading.js";

// ---------------------------------------------------------
// URL + DOM
// ---------------------------------------------------------
let hasLoaded = false;
let ownerUid = null;

const params = new URLSearchParams(window.location.search);
const projectId = params.get("project");

if (!projectId) {
  console.error("❌ No projectId found in URL. Sprint backlog cannot load.");
}

const tbody = document.getElementById("storyList");
const deleteModal = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

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
    loadSprintStories(ownerUid, projectId);
  }
});

// ---------------------------------------------------------
// DELETE MODAL
// ---------------------------------------------------------
cancelDeleteBtn.onclick = () => {
  storyToDelete = null;
  deleteModal.classList.add("hidden");
};

confirmDeleteBtn.onclick = async () => {
  if (!storyToDelete || !ownerUid) return;

  const base = `users/${ownerUid}/projects/${projectId}`;
  await deleteDoc(doc(db, `${base}/sprint-backlog/${storyToDelete}`));

  deleteModal.classList.add("hidden");
  storyToDelete = null;
  loadSprintStories(ownerUid, projectId);
};

// ---------------------------------------------------------
// LOAD SPRINT STORIES
// ---------------------------------------------------------
async function loadSprintStories(uid, projectId) {
  showLoading();

  tbody.innerHTML = "";

  const base = `users/${uid}/projects/${projectId}`;
  const q = query(collection(db, `${base}/sprint-backlog`), orderBy("storyId"));
  const snapshot = await getDocs(q);

  snapshot.forEach((docSnap) => {
    const s = docSnap.data();
    if (s.storyId === "_init") return;

    const tr = document.createElement("tr");
    tr.dataset.docid = docSnap.id;

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
          <div class="menu-item mark-ready" data-id="${s.storyId}">Mark As Ready</div>
          <div class="menu-item delete-item" data-id="${s.storyId}">Delete</div>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  hideLoading();
}

// ---------------------------------------------------------
// MENU + ACTION HANDLERS
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

// Mark Ready
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("mark-ready")) return;
  if (!ownerUid) return;

  const storyId = e.target.dataset.id;
  const base = `users/${ownerUid}/projects/${projectId}`;
  const ref = doc(db, `${base}/sprint-backlog/${storyId}`);

  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();

  await setDoc(ref, {
    ...data,
    status: "Ready",
    updatedAt: Date.now()
  });

  loadSprintStories(ownerUid, projectId);
});

// ---------------------------------------------------------
// SORTING
// ---------------------------------------------------------
let currentSort = null;

document.getElementById("sortBtn").addEventListener("click", () => {
  document.getElementById("sortMenu").classList.toggle("hidden");
});

document.querySelectorAll("#sortMenu div").forEach((option) => {
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

// ---------------------------------------------------------
// COMPLETE SPRINT
// ---------------------------------------------------------

document.getElementById("completeSprintBtn").addEventListener("click", async () => {
  if (!ownerUid) return;

  const rows = Array.from(tbody.querySelectorAll("tr"));

  const sprintStories = rows.map(row => {
    return {
      docId: row.dataset.docid,  // REAL Firestore doc ID
      storyId: row.children[0].innerText.trim(),
      description: row.children[1].innerText.trim(),
      priority: row.children[2].innerText.trim(),
      estimate: row.children[3].innerText.replace(" hrs", "").trim(),
      spike: row.children[4].innerText.trim(),
      status: row.children[5].innerText.trim(),
      assignment: row.children[6].innerText.trim()
    };
  });

  await exportSprintToPDF(sprintStories);
  await completeSprint(ownerUid, projectId, sprintStories);

  alert("Sprint completed");
  loadSprintStories(ownerUid, projectId);
});

async function exportSprintToPDF(stories) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Sprint Backlog", 14, 20);

  doc.setFontSize(12);
  let y = 35;

  stories.forEach(s => {
    doc.text(`ID: ${s.storyId}`, 14, y); y += 6;
    doc.text(`Description: ${s.description}`, 14, y); y += 6;
    doc.text(`Priority: ${s.priority} | Estimate: ${s.estimate}h`, 14, y); y += 6;
    doc.text(`Spike: ${s.spike} | Status: ${s.status}`, 14, y); y += 10;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  doc.save("sprint-backlog.pdf");
}

async function completeSprint(uid, projectId, stories) {
  const base = `users/${uid}/projects/${projectId}`;

  for (const s of stories) {
    const sprintRef = doc(db, `${base}/sprint-backlog/${s.docId}`);

    if (s.status === "Ready") {
      await deleteDoc(sprintRef);
    } else {
      const productRef = doc(db, `${base}/product-backlog/${s.storyId}`);

      await setDoc(productRef, {
        ...s,
        movedBackAt: Date.now()
      });

      await deleteDoc(sprintRef);
    }
  }
}