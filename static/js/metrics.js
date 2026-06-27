import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from "./firebase.js";
import { showLoading, hideLoading } from "./loading.js";
import { showPopup } from "./popup.js";

const auth = getAuth(app);
const db = getFirestore(app);

const teamInfoMenuIcon = document.getElementById("teamInfoMenuIcon");
const teamInfoMenu = document.getElementById("teamInfoMenu");
const editTeamInfoBtn = document.getElementById("editTeamInfoBtn");
const teamInfoModal = document.getElementById("teamInfoModal");
const closeTeamInfoModalBtn = document.getElementById("closeTeamInfoModalBtn");
const saveTeamInfoBtn = document.getElementById("saveTeamInfoBtn");

const teamNameInput = document.getElementById("teamNameInput");
const sprintInput = document.getElementById("sprintInput");
const scrumMasterInput = document.getElementById("scrumMasterInput");
const productOwnerInput = document.getElementById("productOwnerInput");

const teamNameDisplay = document.getElementById("teamNameDisplay");
const sprintDisplay = document.getElementById("sprintDisplay");
const scrumMasterDisplay = document.getElementById("scrumMasterDisplay");
const productOwnerDisplay = document.getElementById("productOwnerDisplay");

let projectId = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "/login"; return; }

    projectId = new URLSearchParams(window.location.search).get("project");
    if (!projectId) { showPopup("Error", "No project specified."); return; }

    await loadTeamInfo();
});

async function loadTeamInfo() {
    showLoading();
    const ref = doc(db, "projects", projectId, "metrics", "teamInfo");
    const snap = await getDoc(ref);

    if (snap.exists()) {
        const data = snap.data();
        teamNameDisplay.textContent = data.teamName || "—";
        sprintDisplay.textContent = data.sprint ?? "—";
        scrumMasterDisplay.textContent = data.scrumMaster || "—";
        productOwnerDisplay.textContent = data.productOwner || "—";
    }
    hideLoading();
}

// Populate Scrum Master / Product Owner dropdowns from project owner + sharedWithNames
async function loadMemberOptions(selectEl, excludeValue) {
    const projectSnap = await getDoc(doc(db, "projects", projectId));
    if (!projectSnap.exists()) return;

    const project = projectSnap.data();
    const members = [];

    const ownerName = project.owner || "Owner";
    members.push(ownerName);

    const sharedWithNames = project.sharedWithNames || {};
    Object.values(sharedWithNames).forEach(name => members.push(name));

    selectEl.innerHTML = `<option value="">Unassigned</option>`;
    members.forEach(name => {
        if (name === excludeValue) return; // mutual exclusivity
        selectEl.innerHTML += `<option value="${name}">${name}</option>`;
    });
}

// Open/close menu
teamInfoMenuIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    teamInfoMenu.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
    if (!teamInfoMenu.contains(e.target)) {
        teamInfoMenu.classList.add("hidden");
    }
});

// Open edit modal, pre-fill with current values
editTeamInfoBtn.addEventListener("click", async () => {
    teamInfoMenu.classList.add("hidden");

    const ref = doc(db, "projects", projectId, "metrics", "teamInfo");
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};

    teamNameInput.value = data.teamName || "";
    sprintInput.value = data.sprint ?? "";

    await loadMemberOptions(scrumMasterInput, data.productOwner || "");
    await loadMemberOptions(productOwnerInput, data.scrumMaster || "");

    scrumMasterInput.value = data.scrumMaster || "";
    productOwnerInput.value = data.productOwner || "";

    teamInfoModal.classList.remove("hidden");
});

closeTeamInfoModalBtn.addEventListener("click", () => {
    teamInfoModal.classList.add("hidden");
});

saveTeamInfoBtn.addEventListener("click", async () => {
    const teamName = teamNameInput.value.trim();
    const sprint = Number(sprintInput.value || 0);
    const scrumMaster = scrumMasterInput.value;
    const productOwner = productOwnerInput.value;

    if (!teamName) {
        showPopup("Missing Team Name", "Please enter a team name.");
        return;
    }

    if (scrumMaster && scrumMaster === productOwner) {
        showPopup("Invalid Assignment", "Scrum Master and Product Owner must be different people.");
        return;
    }

    const ref = doc(db, "projects", projectId, "metrics", "teamInfo");
    await setDoc(ref, { teamName, sprint, scrumMaster, productOwner });

    teamInfoModal.classList.add("hidden");
    await loadTeamInfo();
});

scrumMasterInput.addEventListener("change", async () => {
    const currentProductOwner = productOwnerInput.value;
    await loadMemberOptions(productOwnerInput, scrumMasterInput.value);
    // restore selection if it's still valid
    if (currentProductOwner !== scrumMasterInput.value) {
        productOwnerInput.value = currentProductOwner;
    }
});

productOwnerInput.addEventListener("change", async () => {
    const currentScrumMaster = scrumMasterInput.value;
    await loadMemberOptions(scrumMasterInput, productOwnerInput.value);
    if (currentScrumMaster !== productOwnerInput.value) {
        scrumMasterInput.value = currentScrumMaster;
    }
});