import { useState, useEffect } from "react";
import { generateE2EEKeys } from "../lib/encryption";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError } from "../lib/firebase";
import { OperationType } from "../types";
import { KeyRound, ShieldAlert, ShieldCheck, Download, RefreshCw, Upload } from "lucide-react";

interface UserSetupProps {
  userId: string;
  userEmail: string;
  onKeysReady: (privateKey: string) => void;
}

export default function UserSetup({ userId, onKeysReady }: UserSetupProps) {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localPrivateKey, setLocalPrivateKey] = useState<string | null>(null);
  const [importedKeyFile, setImportedKeyFile] = useState<string>("");

  useEffect(() => {
    // Check if we already have local keys for this user
    const savedKeys = localStorage.getItem(`e2ee_keys_${userId}`);
    if (savedKeys) {
      try {
        const parsed = JSON.parse(savedKeys);
        if (parsed.privateKeyJwk && parsed.publicKeyJwk) {
          setLocalPrivateKey(parsed.privateKeyJwk);
          onKeysReady(parsed.privateKeyJwk);
        }
      } catch (err) {
        console.error("Local keys corrupted", err);
      }
    }
  }, [userId, onKeysReady]);

  const handleGenerateKeys = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // 1. Generate local cryptographically sound RSA key pair
      const keys = await generateE2EEKeys();

      // 2. Save public/private key into current browser storage
      localStorage.setItem(`e2ee_keys_${userId}`, JSON.stringify(keys));

      // 3. Document public key to user profile in Firestore
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        publicKey: keys.publicKeyJwk,
        updatedAt: serverTimestamp(),
      });

      setLocalPrivateKey(keys.privateKeyJwk);
      onKeysReady(keys.privateKeyJwk);
    } catch (err) {
      console.error(err);
      setErrorMessage("Secure key generation failed. Please try again.");
      try {
        handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
      } catch {}
    } finally {
      setLoading(false);
    }
  };

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

  const handleImportKeys = () => {
    setErrorMessage(null);
    try {
      const parsed = JSON.parse(importedKeyFile);
      if (!parsed.privateKeyJwk || !parsed.publicKeyJwk) {
        throw new Error("Invalid key file structure");
      }
      
      localStorage.setItem(`e2ee_keys_${userId}`, JSON.stringify(parsed));
      setLocalPrivateKey(parsed.privateKeyJwk);
      onKeysReady(parsed.privateKeyJwk);
      setImporting(false);
    } catch (err) {
      setErrorMessage("Failed to import key file. Assure file is valid E2EE key JSON.");
    }
  };

  if (localPrivateKey) {
    return (
      <div id="security-active-panel" className="bg-[#EEF2FF] border-b border-primary/10 px-6 py-3 flex items-center justify-between text-xs text-slate-700 font-medium shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#10B981] shrink-0" />
          <span>
            <strong className="text-primary font-bold">End-to-End Encrypted:</strong> Messages are 100% encrypted in your sandbox before transmittal.
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" id="e2ee-setup-modal">
      <div className="w-full max-w-md bg-white border border-vibrant-border rounded-3xl shadow-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-accent"></div>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-primary/10 text-primary rounded-2xl">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-1.5">
              Secure Key Generation
            </h2>
            <p className="text-xs text-slate-400 font-medium">Initialize End-to-End Encryption (E2EE)</p>
          </div>
        </div>

        <div className="space-y-4 mb-6 text-xs text-slate-600 leading-relaxed">
          <p>
            To activate absolute privacy, we generate a unique, cryptographically sound <strong>RSA-OAEP 2048-bit</strong> keypair directly inside your virtual sandbox.
          </p>
          <div className="bg-[#FFFBEB] p-3.5 rounded-xl border border-amber-200 text-xs flex gap-2.5">
            <ShieldAlert className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-slate-700 leading-normal">
              <span className="text-amber-700 font-bold">Session Security Shield:</span> Your private key is stored 
              locally in your user session and never shared with the cloud server or database. Uncompromised privacy guaranteed.
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 text-xs bg-rose-50 border border-rose-100 text-rose-600 rounded-xl mb-4 font-bold">
            {errorMessage}
          </div>
        )}

        {importing ? (
          <div className="space-y-3 mb-6">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
              Paste Key JSON to Restore Session
            </label>
            <textarea
              value={importedKeyFile}
              onChange={(e) => setImportedKeyFile(e.target.value)}
              placeholder='Paste JSON containing {"publicKeyJwk": "...", "privateKeyJwk": "..."}'
              className="w-full h-24 bg-[#F8FAFC] border border-vibrant-border rounded-xl p-3 font-mono text-[11px] text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/45"
            />
            <div className="flex gap-2">
              <button
                onClick={handleImportKeys}
                className="flex-1 py-2.5 bg-primary hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold text-xs transition"
              >
                Restore Keys
              </button>
              <button
                onClick={() => setImporting(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition border border-transparent"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
               onClick={handleGenerateKeys}
               disabled={loading}
               className="w-full py-3 bg-accent hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-500/10 transition flex items-center justify-center gap-2 cursor-pointer"
               id="generate-e2ee-keys-btn"
             >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {loading ? "Generating Safe Keys..." : "Generate Secure Keys & Enter"}
            </button>

            <button
              onClick={() => setImporting(true)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-200/50 cursor-pointer"
            >
              <Upload className="h-3 w-3 text-primary" />
              Import backup private key from another device
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
