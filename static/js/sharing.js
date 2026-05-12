import { auth, db } from "../js/firebase.js";
import { showPopup } from "../js/popup.js";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Send a share request to a user by username or email
export async function sendShareRequest(projectId, targetIdentifier) {
  const user = auth.currentUser;
  if (!user) return;

  const ident = targetIdentifier.trim().toLowerCase();
  if (!ident) {
    showPopup("Invalid Input", "Please enter a username or email.");
    return;
  }

  let targetUid = null;
  let targetName = "";

  if (ident.includes("@")) {
    const q = query(collection(db, "usernames"), where("email", "==", ident));
    const snap = await getDocs(q);
    if (snap.empty) {
      showPopup("User Not Found", "No user exists with that email.");
      return;
    }
    targetUid = snap.docs[0].data().uid;
    targetName = snap.docs[0].data().displayName || "";
  } else {
    const snap = await getDoc(doc(db, "usernames", ident));
    if (!snap.exists()) {
      showPopup("User Not Found", "No user exists with that username.");
      return;
    }
    targetUid = snap.data().uid;
    targetName = snap.data().displayName || "";
  }

  if (!targetUid) {
    showPopup("Error", "Could not find the target user.");
    return;
  }

  if (targetUid === user.uid) {
    showPopup("Invalid Share", "You cannot share a project with yourself.");
    return;
  }

  const projectSnap = await getDoc(doc(db, "projects", projectId));
  if (!projectSnap.exists()) {
    showPopup("Error", "Project not found.");
    return;
  }

  const projectData = projectSnap.data();

  if ((projectData.sharedWith || []).includes(targetUid)) {
    showPopup("Already Shared", `${targetName} already has access to this project.`);
    return;
  }

  const existing = await getDocs(query(
    collection(db, "shareRequests"),
    where("from", "==", user.uid),
    where("to", "==", targetUid),
    where("projectId", "==", projectId)
  ));

  if (!existing.empty) {
    showPopup("Request Pending", `A share request to ${targetName} is already pending.`);
    return;
  }

  await addDoc(collection(db, "shareRequests"), {
    from: user.uid,
    fromName: user.displayName || "",
    to: targetUid,
    toName: targetName,
    projectId,
    projectName: projectData.projectName || "(Unnamed Project)",
    createdAt: Date.now()
  });

  showPopup("Request Sent", `A share request has been sent to ${targetName}.`);
}

// Get all incoming share requests for a user
export async function getIncomingShareRequests(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(
    collection(db, "shareRequests"),
    where("to", "==", uid)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Accept a share request — adds uid + name to the project
export async function acceptShareRequest(requestId) {
  const reqRef = doc(db, "shareRequests", requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) return;

  const { to, toName, projectId } = reqSnap.data();

  await updateDoc(doc(db, "projects", projectId), {
    sharedWith: arrayUnion(to),
    [`sharedWithNames.${to}`]: toName
  });

  await deleteDoc(reqRef);
  window.location.href = "/projects";
}

// Decline a share request — just deletes it
export async function declineShareRequest(requestId) {
  await deleteDoc(doc(db, "shareRequests", requestId));
}