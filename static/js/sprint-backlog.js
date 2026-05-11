import { auth, db } from "../js/firebase.js";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showLoading, hideLoading } from "./loading.js";
import { getProjectOwnerUid } from "./sharing.js";

const storyList = document.getElementById("storyList");
const deleteModal = document.getElementById("deleteModal");

const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

const sortBtn = document.getElementById("sortBtn");
const sortMenu = document.getElementById("sortMenu");
const completeSprintBtn = document.getElementById("completeSprintBtn");

const params = new URLSearchParams(window.location.search);
const projectId = params.get("project");

let currentUid = null;
let storyToDelete = null;
let currentSort = "id";

onAuthStateChanged(auth, async (user) => {
  if (!user || !projectId) return;

  currentUid = user.uid;

  const ownerUid = await getProjectOwnerUid(projectId, currentUid);
  if (!ownerUid) {
    alert("You do not have access to this project.");
    window.location.href = "/projects";
    return;
  }

  await loadStories();
});

async function loadStories() {
  showLoading();
  storyList.innerHTML = "";

  const colRef = collection(db, "projects", projectId, "sprint-backlog");
  const snap = await getDocs(colRef);

  const stories = [];
  snap.forEach((d) => stories.push({ id: d.id, ...d.data() }));

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

function addStoryRow(story) {
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td>${story.numericId || ""}</td>
    <td>${story.description || ""}</td>
    <td>${story.priority || ""}</td>
    <td>${story.estimate || ""}</td>
    <td>${story.spike || ""}</td>
    <td>${story.status || ""}</td>
    <td>${story.assigned || ""}</td>
    <td style="text-align:right;">
      <button class="delete-story-btn" data-id="${story.id}">Delete</button>
    </td>
  `;

  storyList.appendChild(tr);
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete-story-btn")) {
    storyToDelete = e.target.dataset.id;
    deleteModal.classList.remove("hidden");
  }
});

confirmDeleteBtn.onclick = async () => {
  if (!storyToDelete) return;

  await deleteDoc(doc(db, "projects", projectId, "sprint-backlog", storyToDelete));

  deleteModal.classList.add("hidden");
  storyToDelete = null;
  loadStories();
};

cancelDeleteBtn.onclick = () => {
  storyToDelete = null;
  deleteModal.classList.add("hidden");
};

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

completeSprintBtn.onclick = async () => {
  const colRef = collection(db, "projects", projectId, "sprint-backlog");
  const snap = await getDocs(colRef);

  const updates = [];

  snap.forEach((d) => {
    const data = d.data();

    if (data.status === "Done") {
      updates.push(deleteDoc(doc(db, "projects", projectId, "sprint-backlog", d.id)));
    } else {
      updates.push(
        updateDoc(doc(db, "projects", projectId, "sprint-backlog", d.id), {
          status: "Not Ready"
        })
      );
    }
  });

  await Promise.all(updates);
  loadStories();
};