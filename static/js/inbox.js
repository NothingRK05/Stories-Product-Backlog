import { auth } from "../js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

onAuthStateChanged(auth, async (user) => {
  if (!user) { currentUid = null; return; }
  currentUid = user.uid;
  await refreshInbox();
});

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
        <strong>${req.fromName}</strong> wants to share <strong>${req.projectName}</strong>
      </div>
      <div class="inbox-actions">
        <button class="btn accept-btn" data-id="${req.id}">Accept</button>
        <button class="btn decline-btn" data-id="${req.id}">Decline</button>
      </div>
    `;
    inboxList.appendChild(item);
  });
}

// Toggle inbox panel open/closed
inboxIcon.onclick = () => {
  inboxOpen = !inboxOpen;
  inboxPanel.classList.toggle("hidden", !inboxOpen);
  if (inboxOpen) refreshInbox();
};

// Close inbox when clicking outside
document.addEventListener("click", (e) => {
  if (!inboxOpen) return;
  if (!inboxIcon.contains(e.target) && !inboxPanel.contains(e.target)) {
    inboxPanel.classList.add("hidden");
    inboxOpen = false;
  }
});

// Accept / decline buttons
document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("accept-btn")) {
    await acceptShareRequest(e.target.dataset.id);
    // page redirects on accept, no refresh needed
  }
  if (e.target.classList.contains("decline-btn")) {
    await declineShareRequest(e.target.dataset.id);
    await refreshInbox();
  }
});