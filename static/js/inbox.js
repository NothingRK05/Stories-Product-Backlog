import { auth, db } from "./firebase.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const inboxIcon = document.getElementById("inboxIcon");
const inboxPanel = document.getElementById("inboxPanel");
const inboxList = document.getElementById("inboxList");
const inboxBadge = document.getElementById("inboxBadge");

let inboxOpen = false;

inboxIcon.onclick = () => {
  inboxOpen = !inboxOpen;
  inboxPanel.classList.toggle("hidden", !inboxOpen);
};

document.addEventListener("click", (e) => {
  if (!inboxIcon.contains(e.target) && !inboxPanel.contains(e.target)) {
    inboxPanel.classList.add("hidden");
    inboxOpen = false;
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user) return;

  const q = query(
    collection(db, "shareRequests"),
    where("to", "==", user.uid),
    where("status", "==", "pending")
  );

  onSnapshot(q, (snapshot) => {
    inboxList.innerHTML = "";

    if (snapshot.empty) {
      inboxBadge.classList.add("hidden");
      inboxList.innerHTML = "<p>No pending requests</p>";
      return;
    }

    inboxBadge.classList.remove("hidden");
    inboxBadge.textContent = snapshot.size;

    snapshot.forEach((docSnap) => {
      const req = docSnap.data();

      const div = document.createElement("div");
      div.classList.add("request-item");

      div.innerHTML = `
        <strong>${req.projectName}</strong>
        <p>Shared by: ${req.fromName}</p>
        <div class="request-actions">
          <button class="btn accept-btn" data-id="${docSnap.id}">Accept</button>
          <button class="btn cancel-btn decline-btn" data-id="${docSnap.id}">Decline</button>
        </div>
      `;

      inboxList.appendChild(div);
    });
  });
});

document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("accept-btn")) {
    const id = e.target.dataset.id;
    const ref = doc(db, "shareRequests", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const req = snap.data();

    const target = doc(db, `users/${req.to}/shared-projects/${req.projectId}`);
    await setDoc(target, {
      projectId: req.projectId,
      projectName: req.projectName,
      owner: req.from
    });

    await updateDoc(ref, { status: "accepted" });
  }

  if (e.target.classList.contains("decline-btn")) {
    const id = e.target.dataset.id;
    const ref = doc(db, "shareRequests", id);
    await updateDoc(ref, { status: "declined" });
  }
});