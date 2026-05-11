import { auth } from "../js/firebase.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getIncomingShareRequests,
  acceptShareRequest,
  declineShareRequest
} from "./sharing.js";

const inboxIcon = document.getElementById("inboxIcon");
const inboxBadge = document.getElementById("inboxBadge");
const inboxPanel = document.getElementById("inboxPanel");
const inboxList = document.getElementById("inboxList");

let currentUid = null;
let inboxOpen = false;

/* ============================================================
   AUTH + INITIAL LOAD
   ============================================================ */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUid = null;
    return;
  }

  currentUid = user.uid;
  await refreshInbox();
});

/* ============================================================
   REFRESH INBOX
   ============================================================ */

async function refreshInbox() {
  if (!currentUid) return;

  const requests = await getIncomingShareRequests(currentUid);
  inboxList.innerHTML = "";

  if (requests.length === 0) {
    inboxList.innerHTML = `<p class="empty-text">No share requests.</p>`;
    inboxBadge.classList.add("hidden");
    return;
  }

  inboxBadge.textContent = requests.length;
  inboxBadge.classList.remove("hidden");

  requests.forEach((req) => {
    const item = document.createElement("div");
    item.classList.add("inbox-item");

    item.innerHTML = `
      <div class="inbox-text">
        <span><strong>${req.fromName}</strong> wants to share <strong>${req.projectName}</strong></span>
      </div>

      <div class="inbox-actions">
        <button class="btn accept-btn" data-id="${req.id}">Accept</button>
        <button class="btn decline-btn" data-id="${req.id}">Decline</button>
      </div>
    `;

    inboxList.appendChild(item);
  });
}

/* ============================================================
   TOGGLE INBOX PANEL
   ============================================================ */

inboxIcon.onclick = () => {
  inboxOpen = !inboxOpen;

  if (inboxOpen) {
    inboxPanel.classList.remove("hidden");
    refreshInbox();
  } else {
    inboxPanel.classList.add("hidden");
  }
};

document.addEventListener("click", (e) => {
  if (!inboxOpen) return;

  const clickedInboxIcon = inboxIcon.contains(e.target);
  const clickedInboxPanel = inboxPanel.contains(e.target);

  if (!clickedInboxIcon && !clickedInboxPanel) {
    inboxPanel.classList.add("hidden");
    inboxOpen = false;
  }
});

/* ============================================================
   ACCEPT / DECLINE HANDLERS
   ============================================================ */

document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("accept-btn")) {
    const id = e.target.dataset.id;
    await acceptShareRequest(id);
    await refreshInbox();
  }

  if (e.target.classList.contains("decline-btn")) {
    const id = e.target.dataset.id;
    await declineShareRequest(id);
    await refreshInbox();
  }
});