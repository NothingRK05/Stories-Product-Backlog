import { auth } from "../js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getIncomingShareRequests, acceptShareRequest, declineShareRequest } from "./sharing.js";

const inboxIcon = document.getElementById("inboxIcon");
const inboxBadge = document.getElementById("inboxBadge");
const inboxPanel = document.getElementById("inboxPanel");
const inboxList = document.getElementById("inboxList");

let currentUid = null;
let inboxOpen = false;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUid = null;
    if (inboxBadge) inboxBadge.classList.add("hidden");
    if (inboxPanel) inboxPanel.classList.add("hidden");
    return;
  }
  currentUid = user.uid;
  await refreshInbox();
});

async function refreshInbox() {
  if (!currentUid || !inboxList) return;
  const requests = await getIncomingShareRequests(currentUid);

  inboxList.innerHTML = "";
  if (requests.length === 0) {
    inboxList.innerHTML = `<p class="empty-text">No share requests.</p>`;
    if (inboxBadge) inboxBadge.classList.add("hidden");
    return;
  }

  if (inboxBadge) {
    inboxBadge.textContent = requests.length;
    inboxBadge.classList.remove("hidden");
  }

  requests.forEach((req) => {
    const item = document.createElement("div");
    item.classList.add("inbox-item");
    item.innerHTML = `
      <div class="inbox-text">
        <span>Project share request for <strong>${req.projectId}</strong></span>
      </div>
      <div class="inbox-actions">
        <button class="btn accept-btn" data-id="${req.id}">Accept</button>
        <button class="btn cancel-btn decline-btn" data-id="${req.id}">Decline</button>
      </div>
    `;
    inboxList.appendChild(item);
  });
}

if (inboxIcon) {
  inboxIcon.onclick = () => {
    inboxOpen = !inboxOpen;
    if (!inboxPanel) return;
    if (inboxOpen) {
      inboxPanel.classList.remove("hidden");
      refreshInbox();
    } else {
      inboxPanel.classList.add("hidden");
    }
  };
}

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