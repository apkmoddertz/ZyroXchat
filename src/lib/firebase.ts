import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile 
} from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import { OperationType, FirestoreErrorInfo } from "../types";

// The user-provided custom Firebase configuration options
const firebaseConfig = {
  apiKey: "AIzaSyDsGH0kK1qjErrdp7x89UhT8I3-Suk30vs",
  authDomain: "zyromod-com.firebaseapp.com",
  projectId: "zyromod-com",
  storageBucket: "zyromod-com.firebasestorage.app",
  messagingSenderId: "872483311302",
  appId: "1:872483311302:web:efd27e31655711993e51c7"
};

// Initialize Firebase with the provided config
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Google login
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google authentication failed:", error);
    throw error;
  }
}

// Email/Password Registration
export async function registerWithEmailPassword(email: string, pass: string, name: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(result.user, {
      displayName: name,
      photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || "user")}`
    });
    return result.user;
  } catch (error) {
    console.error("Email registration failed:", error);
    throw error;
  }
}

// Email/Password Login
export async function loginWithEmailPassword(email: string, pass: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error) {
    console.error("Email login failed:", error);
    throw error;
  }
}

// Standard logout
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign-out failed:", error);
    throw error;
  }
}

// Error handling helper
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email || null,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error details:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("offline")) {
      console.warn("Firestore is ready in offline-capable mode.");
    }
  }
}
testConnection();
