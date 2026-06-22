import { useState, useEffect } from "react";
import { generateE2EEKeys } from "../lib/encryption";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ShieldCheck, Download, RefreshCw } from "lucide-react";

interface UserSetupProps {
  userId: string;
  userEmail: string;
  onKeysReady: (privateKey: string) => void;
}

export default function UserSetup({ userId, onKeysReady }: UserSetupProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localPrivateKey, setLocalPrivateKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const initKeys = async () => {
      // 1. Check if we already have local keys for this user in localStorage
      const savedKeys = localStorage.getItem(`e2ee_keys_${userId}`);
      if (savedKeys) {
        try {
          const parsed = JSON.parse(savedKeys);
          if (parsed.privateKeyJwk && parsed.publicKeyJwk) {
            if (active) {
              setLocalPrivateKey(parsed.privateKeyJwk);
              onKeysReady(parsed.privateKeyJwk);
            }
            return;
          }
        } catch (err) {
          console.error("Local keys corrupted:", err);
        }
      }

      // 2. Generate E2EE keys silently if they do not exist
      if (active) {
        setLoading(true);
        setErrorMessage(null);
      }

      try {
        const keys = await generateE2EEKeys();

        // Save local keypair to browser session
        localStorage.setItem(`e2ee_keys_${userId}`, JSON.stringify(keys));

        // Document public key in Firestore without blocking if it fails (temporary connection/roles issue)
        try {
          const userRef = doc(db, "users", userId);
          await updateDoc(userRef, {
            publicKey: keys.publicKeyJwk,
            updatedAt: serverTimestamp(),
          });
        } catch (firestoreErr) {
          console.warn("Could not sync E2EE public key to Cloud, using local keypair:", firestoreErr);
        }

        if (active) {
          setLocalPrivateKey(keys.privateKeyJwk);
          onKeysReady(keys.privateKeyJwk);
        }
      } catch (err) {
        console.error("E2EE key generation failed:", err);
        if (active) {
          setErrorMessage("Secure workspace initialization offline");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    initKeys();

    return () => {
      active = false;
    };
  }, [userId, onKeysReady]);

  const downloadBackup = () => {
    const backupKeys = localStorage.getItem(`e2ee_keys_${userId}`);
    if (!backupKeys) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(backupKeys);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `secure_chat_e2ee_${userId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (!localPrivateKey) {
    return (
      <div id="security-active-panel" className="bg-[#EFF6FF] border-b border-primary/10 px-6 py-3 flex items-center justify-between text-xs text-slate-700 font-medium shrink-0 animate-pulse animate-duration-1000">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span>
            <strong className="text-primary font-bold">Securing Workspace:</strong> Initializing end-to-end encrypted (E2EE) session keypairs...
          </span>
        </div>
        {errorMessage && (
          <span className="text-amber-600 font-mono text-[10px]">{errorMessage}</span>
        )}
      </div>
    );
  }

  return (
    <div id="security-active-panel" className="bg-[#EEF2FF] border-b border-primary/10 px-6 py-3 flex items-center justify-between text-xs text-slate-700 font-medium shrink-0">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[#10B981] shrink-0 animate-bounce animate-once" />
        <span>
          <strong className="text-primary font-bold">E2EE Safeguard Active:</strong> Real-time messages are encrypted locally before submission.
        </span>
      </div>
      <button
        onClick={downloadBackup}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-vibrant-border active:bg-slate-100 text-slate-700 rounded-xl shadow-xs transition font-semibold text-xs whitespace-nowrap cursor-pointer"
        id="backup-keys-btn"
      >
        <Download className="h-3.5 w-3.5 text-primary" />
        Backup Private Key
      </button>
    </div>
  );
}
