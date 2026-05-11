import { auth, db } from "./firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ---------------------------------------------------------
   SEND SHARE REQUEST
--------------------------------------------------------- */
export async function sendShareRequest(targetUid, projectId, projectName) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  await addDoc(collection(db, "shareRequests"), {
    from: user.uid,
    to: targetUid,
    projectId,
    projectName,
    status: "pending",
    createdAt: Date.now()
  });
}

/* ---------------------------------------------------------
   ACCEPT SHARE REQUEST
--------------------------------------------------------- */
export async function acceptShareRequest(requestId, requestData) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const { from: ownerUid, projectId, projectName } = requestData;

  const projectRef = doc(db, `users/${ownerUid}/projects/${projectId}`);
  await updateDoc(projectRef, {
    sharedWith: arrayUnion(user.uid)
  });

  const mirrorRef = doc(db, `users/${user.uid}/shared-projects/${projectId}`);
  await setDoc(mirrorRef, {
    owner: ownerUid,
    projectId,
    projectName,
    addedAt: Date.now()
  });

  const reqRef = doc(db, `shareRequests/${requestId}`);
  await updateDoc(reqRef, { status: "accepted" });
}

/* ---------------------------------------------------------
   DECLINE SHARE REQUEST
--------------------------------------------------------- */
export async function declineShareRequest(requestId) {
  const reqRef = doc(db, `shareRequests/${requestId}`);
  await updateDoc(reqRef, { status: "declined" });
}

/* ---------------------------------------------------------
   GET OWNER UID FOR A PROJECT
--------------------------------------------------------- */
export async function getProjectOwner(projectId, currentUid) {
  const ownRef = doc(db, `users/${currentUid}/projects/${projectId}`);
  const ownSnap = await getDoc(ownRef);
  if (ownSnap.exists()) return currentUid;

  const sharedRef = doc(db, `users/${currentUid}/shared-projects/${projectId}`);
  const sharedSnap = await getDoc(sharedRef);
  if (sharedSnap.exists()) return sharedSnap.data().owner;

  return null;
}