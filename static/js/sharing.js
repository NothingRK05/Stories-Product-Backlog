import { auth, db } from "./firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  collection,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ---------------------------------------------------------
   SEND SHARE REQUEST
--------------------------------------------------------- */
export async function sendShareRequest(targetIdentifier, projectId, projectName) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const identifier = targetIdentifier.trim().toLowerCase();
  const usernameRef = doc(db, "usernames", identifier);
  const usernameSnap = await getDoc(usernameRef);
  let targetUid = null;

  if (usernameSnap.exists()) {
    targetUid = usernameSnap.data().uid;
  } else {
    const usersRef = collection(db, "users");
    const usersSnap = await getDocs(usersRef);

    usersSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.email && data.email.toLowerCase() === identifier) {
        targetUid = docSnap.id;
      }
    });
  }

  if (!targetUid) {
    throw new Error("User not found.");
  }

  if (targetUid === user.uid) {
    throw new Error("You cannot share a project with yourself.");
  }

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