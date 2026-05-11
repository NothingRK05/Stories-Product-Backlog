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

/* ============================================================
   SEND SHARE REQUEST
   ============================================================ */

export async function sendShareRequest(projectId, targetIdentifier) {
  const user = auth.currentUser;
  if (!user) return;

  const senderUid = user.uid;
  const senderName = user.displayName || "";

  const ident = targetIdentifier.trim().toLowerCase();
  if (!ident) {
    showPopup("Invalid Input", "Please enter a username or email.");
    return;
  }

  let targetUid = null;
  let targetName = "";

  if (ident.includes("@")) {
    const usernamesCol = collection(db, "usernames");
    const q = query(usernamesCol, where("email", "==", ident));
    const snap = await getDocs(q);

    if (snap.empty) {
      showPopup("User Not Found", "No user exists with that email.");
      return;
    }

    const data = snap.docs[0].data();
    targetUid = data.uid;
    targetName = data.displayName || "";
  }

  else {
    const usernameRef = doc(db, "usernames", ident);
    const usernameSnap = await getDoc(usernameRef);

    if (!usernameSnap.exists()) {
      showPopup("User Not Found", "No user exists with that username.");
      return;
    }

    const data = usernameSnap.data();
    targetUid = data.uid;
    targetName = data.displayName || "";
  }

  if (!targetUid) {
    showPopup("Error", "Could not find the target user.");
    return;
  }

  if (targetUid === senderUid) {
    showPopup("Invalid Share", "You cannot share a project with yourself.");
    return;
  }

  const projectRef = doc(db, "projects", projectId);
  const projectSnap = await getDoc(projectRef);

  if (!projectSnap.exists()) {
    showPopup("Error", "Project not found.");
    return;
  }

  const sharedWith = projectSnap.data().sharedWith || [];

  if (sharedWith.includes(targetUid)) {
    showPopup("Already Shared", `${targetName} already has access to this project.`);
    return;
  }

  const reqQuery = query(
    collection(db, "shareRequests"),
    where("from", "==", senderUid),
    where("to", "==", targetUid),
    where("projectId", "==", projectId)
  );

  const reqSnap = await getDocs(reqQuery);

  if (!reqSnap.empty) {
    showPopup("Request Pending", `A share request to ${targetName} is already pending.`);
    return;
  }

  const projectName = projectSnap.data().projectName || "(Unnamed Project)";

  await addDoc(collection(db, "shareRequests"), {
    from: senderUid,
    fromName: senderName,
    to: targetUid,
    toName: targetName,
    projectId,
    projectName,
    createdAt: Date.now()
  });

  showPopup("Request Sent", `A share request has been sent to ${targetName}.`);
}


/* ============================================================
   GET INCOMING SHARE REQUESTS
   ============================================================ */

export async function getIncomingShareRequests(uid) {
  if (!uid) return [];

  const colRef = collection(db, "shareRequests");
  const q = query(colRef, where("to", "==", uid));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data()
  }));
}

/* ============================================================
   ACCEPT SHARE REQUEST
   ============================================================ */

export async function acceptShareRequest(requestId) {
  const reqRef = doc(db, "shareRequests", requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) return;

  const { to, projectId } = reqSnap.data();

  const projectRef = doc(db, "projects", projectId);
  await updateDoc(projectRef, {
    sharedWith: arrayUnion(to)
  });

  await deleteDoc(reqRef);

  window.location.href = "/projects";
}

/* ============================================================
   DECLINE SHARE REQUEST
   ============================================================ */

export async function declineShareRequest(requestId) {
  const reqRef = doc(db, "shareRequests", requestId);
  await deleteDoc(reqRef);
}