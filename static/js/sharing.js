import { auth, db } from "../js/firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// get project ownerUid if current user has access, else null
export async function getProjectOwnerUid(projectId, currentUid) {
  const ref = doc(db, "projects", projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data();
  if (data.ownerUid === currentUid) return data.ownerUid;
  if (Array.isArray(data.sharedWith) && data.sharedWith.includes(currentUid)) return data.ownerUid;
  return null;
}

// send share request to target usernameLower or email
export async function sendShareRequest(projectId, targetIdentifier) {
  const user = auth.currentUser;
  if (!user) return;

  const ident = targetIdentifier.trim().toLowerCase();
  let usernameLower = ident;
  if (ident.includes("@")) {
    usernameLower = ident.split("@")[0];
  }

  const usernameRef = doc(db, "usernames", usernameLower);
  const usernameSnap = await getDoc(usernameRef);
  if (!usernameSnap.exists()) return;

  const targetUid = usernameSnap.data().uid;
  if (!targetUid || targetUid === user.uid) return;

  await addDoc(collection(db, "shareRequests"), {
    from: user.uid,
    to: targetUid,
    projectId,
    createdAt: Date.now()
  });
}

// accept share request
export async function acceptShareRequest(requestId) {
  const reqRef = doc(db, "shareRequests", requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) return;

  const { from, to, projectId } = reqSnap.data();

  const projectRef = doc(db, "projects", projectId);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) {
    await deleteDoc(reqRef);
    return;
  }

  const projectData = projectSnap.data();
  const shared = Array.isArray(projectData.sharedWith) ? projectData.sharedWith : [];
  if (!shared.includes(to)) shared.push(to);

  await updateDoc(projectRef, { sharedWith: shared });

  await setDoc(
    doc(db, "users", to, "shared-projects", projectId),
    {
      projectId,
      projectName: projectData.projectName,
      owner: projectData.owner,
      ownerUid: projectData.ownerUid,
      ownerUsernameLower: projectData.ownerUsernameLower || ""
    },
    { merge: true }
  );

  await deleteDoc(reqRef);
}

// decline share request
export async function declineShareRequest(requestId) {
  await deleteDoc(doc(db, "shareRequests", requestId));
}

// get incoming share requests for a user
export async function getIncomingShareRequests(uid) {
  const q = query(collection(db, "shareRequests"), where("to", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}