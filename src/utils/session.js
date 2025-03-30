import { auth, db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export const initializeSession = async () => {
  const user = auth.currentUser;
  if (!user) return;

  // Update user's online status
  await setDoc(
    doc(db, "users", user.uid),
    {
      displayName: user.displayName,
      photoURL: user.photoURL,
      status: "online",
      lastSeen: serverTimestamp(),
    },
    { merge: true }
  );

  // Set up beforeunload event to update status when tab is closed
  const handleTabClose = async () => {
    if (user) {
      await setDoc(
        doc(db, "users", user.uid),
        {
          status: "offline",
          lastSeen: serverTimestamp(),
        },
        { merge: true }
      );
    }
  };

  window.addEventListener("beforeunload", handleTabClose);

  // Return cleanup function
  return () => {
    window.removeEventListener("beforeunload", handleTabClose);
    handleTabClose();
  };
};

export const updateUserStatus = async (status) => {
  const user = auth.currentUser;
  if (!user) return;

  await setDoc(
    doc(db, "users", user.uid),
    {
      status,
      lastSeen: serverTimestamp(),
    },
    { merge: true }
  );
};
