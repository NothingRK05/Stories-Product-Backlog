import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, getDocs, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
    await loadMemberMetrics();
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

// ── Member Metrics ──────────────────────────────────────────

const metricsMenuIcon = document.getElementById("metricsMenuIcon");
const metricsMenu = document.getElementById("metricsMenu");
const editMemberMetricsBtn = document.getElementById("editMemberMetricsBtn");
const memberMetricsModal = document.getElementById("memberMetricsModal");
const closeMemberMetricsModalBtn = document.getElementById("closeMemberMetricsModalBtn");
const saveMemberMetricsBtn = document.getElementById("saveMemberMetricsBtn");
const memberSelect = document.getElementById("memberSelect");
const capacityInput = document.getElementById("capacityInput");
const hoursWorkedInput = document.getElementById("hoursWorkedInput");
const metricsTableBody = document.getElementById("metricsTableBody");
const metricsTableFoot = document.getElementById("metricsTableFoot");

// Open/close metrics menu
metricsMenuIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    metricsMenu.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
    if (!metricsMenu.contains(e.target)) metricsMenu.classList.add("hidden");
});

// Open edit modal — populate member dropdown and pre-fill saved values
editMemberMetricsBtn.addEventListener("click", async () => {
    metricsMenu.classList.add("hidden");

    const projectSnap = await getDoc(doc(db, "projects", projectId));
    if (!projectSnap.exists()) return;

    const project = projectSnap.data();
    const members = getMembers(project);

    memberSelect.innerHTML = "";
    members.forEach(name => {
        memberSelect.innerHTML += `<option value="${name}">${name}</option>`;
    });

    await prefillMemberInputs();
    memberMetricsModal.classList.remove("hidden");
});

// When member selection changes, pre-fill their saved values
memberSelect.addEventListener("change", prefillMemberInputs);

async function prefillMemberInputs() {
    const name = memberSelect.value;
    if (!name) return;

    const snap = await getDoc(doc(db, "projects", projectId, "metrics", `member_${name}`));
    const data = snap.exists() ? snap.data() : {};
    capacityInput.value = data.estimatedCapacity ?? "";
    hoursWorkedInput.value = data.hoursWorked ?? "";
}

closeMemberMetricsModalBtn.addEventListener("click", () => {
    memberMetricsModal.classList.add("hidden");
});

saveMemberMetricsBtn.addEventListener("click", async () => {
    const name = memberSelect.value;
    const estimatedCapacity = Number(capacityInput.value || 0);
    const hoursWorked = Number(hoursWorkedInput.value || 0);

    if (!name) return;

    await setDoc(doc(db, "projects", projectId, "metrics", `member_${name}`), {
        estimatedCapacity,
        hoursWorked
    }, { merge: true });

    memberMetricsModal.classList.add("hidden");
    await loadMemberMetrics();
});

// Get all project members as a flat array
function getMembers(project) {
    const members = [];
    if (project.owner) members.push(project.owner);
    const sharedWithNames = project.sharedWithNames || {};
    Object.values(sharedWithNames).forEach(n => members.push(n));
    return members;
}

// Load sprint backlog and compute per-member metrics
async function loadMemberMetrics() {
    const projectSnap = await getDoc(doc(db, "projects", projectId));
    if (!projectSnap.exists()) return;

    const project = projectSnap.data();
    const members = getMembers(project);

    // Load sprint backlog stories
    const sprintSnap = await getDocs(collection(db, "projects", projectId, "sprint-backlog"));
    const stories = sprintSnap.docs
        .filter(d => d.id !== "_placeholder")
        .map(d => d.data());

    // Build per-member rows
    const rows = await Promise.all(members.map(async (name) => {
        // Firestore saved data
        const savedSnap = await getDoc(doc(db, "projects", projectId, "metrics", `member_${name}`));
        const saved = savedSnap.exists() ? savedSnap.data() : {};

        const estimatedCapacity = saved.estimatedCapacity ?? 0;
        const hoursWorked = saved.hoursWorked ?? 0;

        // From sprint backlog
        const assigned = stories.filter(s => s.assigned === name);
        const storyPointsCommitted = assigned.reduce((sum, s) => sum + (s.estimate || 0), 0);
        const storyPointsDelivered = assigned
            .filter(s => s.status === "Ready")
            .reduce((sum, s) => sum + (s.estimate || 0), 0);

        const spikes = assigned.filter(s => s.spike === "Yes").length;
        const nonSpikes = assigned.filter(s => s.spike === "No").length;

        // Calculated percentages
        const capacityToEffort = estimatedCapacity > 0 ? Math.round((hoursWorked / estimatedCapacity) * 100) : 0;
        const committedToDelivered = storyPointsCommitted > 0 ? Math.round((storyPointsDelivered / storyPointsCommitted) * 100) : 0;
        const capacityToDelivered = estimatedCapacity > 0 ? Math.round((storyPointsDelivered / estimatedCapacity) * 100) : 0;

        return {
            name,
            estimatedCapacity,
            storyPointsCommitted,
            hoursWorked,
            storyPointsDelivered,
            capacityToEffort,
            committedToDelivered,
            capacityToDelivered,
            spikes,
            nonSpikes
        };
    }));

    renderMetricsTable(rows);
}

function renderMetricsTable(rows) {
    metricsTableBody.innerHTML = "";

    rows.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r.name}</td>
            <td>${r.estimatedCapacity}</td>
            <td>${r.storyPointsCommitted}</td>
            <td>${r.hoursWorked}</td>
            <td>${r.storyPointsDelivered}</td>
            <td>${r.capacityToEffort}%</td>
            <td>${r.committedToDelivered}%</td>
            <td>${r.capacityToDelivered}%</td>
            <td>${r.spikes} / ${r.nonSpikes}</td>
        `;
        metricsTableBody.appendChild(tr);
    });

    // Totals row
    const totals = rows.reduce((acc, r) => {
        acc.estimatedCapacity += r.estimatedCapacity;
        acc.storyPointsCommitted += r.storyPointsCommitted;
        acc.hoursWorked += r.hoursWorked;
        acc.storyPointsDelivered += r.storyPointsDelivered;
        acc.spikes += r.spikes;
        acc.nonSpikes += r.nonSpikes;
        return acc;
    }, { estimatedCapacity: 0, storyPointsCommitted: 0, hoursWorked: 0, storyPointsDelivered: 0, spikes: 0, nonSpikes: 0 });

    const totalCapacityToEffort = totals.estimatedCapacity > 0 ? Math.round((totals.hoursWorked / totals.estimatedCapacity) * 100) : 0;
    const totalCommittedToDelivered = totals.storyPointsCommitted > 0 ? Math.round((totals.storyPointsDelivered / totals.storyPointsCommitted) * 100) : 0;
    const totalCapacityToDelivered = totals.estimatedCapacity > 0 ? Math.round((totals.storyPointsDelivered / totals.estimatedCapacity) * 100) : 0;

    metricsTableFoot.innerHTML = `
        <tr>
            <td>Team Totals</td>
            <td>${totals.estimatedCapacity}</td>
            <td>${totals.storyPointsCommitted}</td>
            <td>${totals.hoursWorked}</td>
            <td>${totals.storyPointsDelivered}</td>
            <td>${totalCapacityToEffort}%</td>
            <td>${totalCommittedToDelivered}%</td>
            <td>${totalCapacityToDelivered}%</td>
            <td>${totals.spikes} / ${totals.nonSpikes}</td>
        </tr>
    `;
}