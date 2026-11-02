
import { auth, db } from "./firebase.js";

import {
  collection, doc, getDoc, onSnapshot,
  addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const projectId =
  new URLSearchParams(window.location.search).get("project");

const list = document.getElementById("notesList");
const message = document.getElementById("notesMessage");
const modal = document.getElementById("noteModal");
const form = document.getElementById("noteForm");
const titleInput = document.getElementById("noteTitle");
const contentInput = document.getElementById("noteContent");
const saveBtn = document.getElementById("saveNoteBtn");
const newBtn = document.getElementById("newNoteBtn");

let currentUser = null;
let editingId = null;
let notes = [];
let unsubscribe = null;

// Map navigation buttons
for (const [id, path] of [
  ["switchSprintBtn", "sprint-backlog"],
  ["switchProductBtn", "product-backlog"],
  ["switchMetricsBtn", "metrics"]
]) {
  document.getElementById(id).href = projectId
    ? `/${path}?project=${encodeURIComponent(projectId)}`
    : "/projects";
}

function showMessage(text) {
  message.textContent = text;
}

function closeModal() {
  modal.classList.add("hidden");
  editingId = null;
  form.reset();
}

function openModal(note = null) {
  editingId = note?.id || null;

  document.getElementById("noteModalTitle").textContent =
    note ? "Edit Note" : "Create Note";

  titleInput.value = note?.title || "";
  contentInput.value = note?.content || "";

  modal.classList.remove("hidden");
  titleInput.focus();
}

// Create button
newBtn.addEventListener("click", () => openModal());

// Cancel button
document.getElementById("cancelNoteBtn")
  .addEventListener("click", closeModal);

// Close by clicking outside
modal.addEventListener("click", e => {
  if (e.target === modal) closeModal();
});

// Verify login and project membership
onAuthStateChanged(auth, async user => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  currentUser = null;
  newBtn.disabled = true;
  list.replaceChildren();

  if (!user) {
    window.location.replace("/logins/login.html");
    return;
  }

  if (!projectId) {
    showMessage("No project selected.");
    return;
  }

  try {
    const projectSnap = await getDoc(
      doc(db, "projects", projectId)
    );

    if (!projectSnap.exists()) {
      showMessage("Project not found.");
      return;
    }

    const project = projectSnap.data();

    const isMember =
      project.ownerUid === user.uid ||
      (project.sharedWith || []).includes(user.uid);

    if (!isMember) {
      showMessage("You don't have access to these notes.");
      return;
    }

    if (auth.currentUser?.uid !== user.uid) return;

    currentUser = user;
    newBtn.disabled = false;

    document.getElementById("projectName").textContent =
      project.projectName || "Team Workspace";

    // Load notes in real time
    const notesQuery = query(
      collection(db, "projects", projectId, "team-notes"),
      orderBy("updatedAt", "desc")
    );

    unsubscribe = onSnapshot(notesQuery, snapshot => {
      notes = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      renderNotes();

      showMessage(
        notes.length ? "" : "No team notes yet. Create one!"
      );
    }, error => {
      console.error(error);
      showMessage("Couldn't load notes. Check permissions.");
    });

  } catch (error) {
    console.error(error);
    showMessage("Couldn't open the project.");
  }
});

// Display notes
function renderNotes() {
  list.replaceChildren();

  for (const note of notes) {
    const card = document.createElement("article");
    card.className = "note-card";

    const heading = document.createElement("h3");
    heading.textContent = note.title || "Untitled Note";

    const body = document.createElement("div");
    body.className = "note-body";
    body.textContent = note.content || "";

    const meta = document.createElement("div");
    meta.className = "note-meta";

    const date = note.updatedAt?.toDate?.();

    meta.textContent =
      `Updated by ${note.updatedByName || "Team member"}` +
      (date ? ` · ${date.toLocaleString()}` : "");

    const actions = document.createElement("div");
    actions.className = "notes-card-actions";

    // Edit
    const edit = document.createElement("button");
    edit.className = "btn";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => openModal(note));

    // Delete
    const remove = document.createElement("button");
    remove.className = "btn notes-delete";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => removeNote(note));

    actions.append(edit, remove);
    card.append(heading, body, meta, actions);
    list.append(card);
  }
}

// Save note
form.addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentUser || !projectId) return;

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title || !content) return;

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const fields = {
      title,
      content,
      updatedAt: serverTimestamp(),
      updatedByUid: currentUser.uid,
      updatedByName:
        currentUser.displayName ||
        currentUser.email ||
        "Team member"
    };

    if (editingId) {
      await updateDoc(
        doc(db, "projects", projectId, "team-notes", editingId),
        fields
      );
    } else {
      await addDoc(
        collection(db, "projects", projectId, "team-notes"),
        {
          ...fields,
          createdAt: serverTimestamp(),
          createdByUid: currentUser.uid
        }
      );
    }

    closeModal();
    showMessage("Note saved!");

  } catch (error) {
    console.error(error);
    showMessage("Save failed. Check Firestore permissions.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Note";
  }
});

// Delete note
async function removeNote(note) {
  if (!currentUser) return;

  if (!confirm(`Delete "${note.title}"?`)) return;

  try {
    await deleteDoc(
      doc(db, "projects", projectId, "team-notes", note.id)
    );

    showMessage("Note deleted.");
  } catch (error) {
    console.error(error);
    showMessage("Delete failed. Check permissions.");
  }
}
