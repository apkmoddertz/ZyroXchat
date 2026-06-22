// Utility to convert ArrayBuffer to Base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Utility to convert Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate RSA-OAEP key pair for E2EE
export async function generateE2EEKeys(): Promise<{
  publicKeyJwk: string;
  privateKeyJwk: string;
}> {
  const keypair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );

  const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", keypair.publicKey);
  const privateKeyJwk = await window.crypto.subtle.exportKey("jwk", keypair.privateKey);

  return {
    publicKeyJwk: JSON.stringify(publicKeyJwk),
    privateKeyJwk: JSON.stringify(privateKeyJwk),
  };
}

// Encrypt a cleartext message with generated AES session key, then seal AES key with RSA-OAEP for all recipients
export async function encryptMessage(
  text: string,
  recipients: { userId: string; publicKeyJwkString: string }[]
): Promise<{
  encryptedContent: string;
  iv: string;
  recipientKeys: { [userId: string]: string };
}> {
  if (recipients.length === 0) {
    throw new Error("No recipients specified for encryption");
  }

  // 1. Generate AES-GCM 256-bit session key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // 2. Encrypt text with AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const textBuffer = encoder.encode(text);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    textBuffer
  );

  const encryptedContent = arrayBufferToBase64(encryptedBuffer);
  const ivBase64 = arrayBufferToBase64(iv.buffer);

  // 3. Export raw AES session key
  const aesRawKey = await window.crypto.subtle.exportKey("raw", aesKey);

  // 4. Encrypt session key with each recipient's public key (RSA-OAEP)
  const recipientKeys: { [userId: string]: string } = {};

  for (const r of recipients) {
    try {
      if (!r.publicKeyJwkString) continue;
      const pubJwk = JSON.parse(r.publicKeyJwkString);
      const rsaPublicKey = await window.crypto.subtle.importKey(
        "jwk",
        pubJwk,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
      );

      const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        rsaPublicKey,
        aesRawKey
      );

      recipientKeys[r.userId] = arrayBufferToBase64(encryptedKeyBuffer);
    } catch (err) {
      console.error(`Encryption failed for recipient ${r.userId}:`, err);
    }
  }

  return {
    encryptedContent,
    iv: ivBase64,
    recipientKeys,
  };
}

// Decrypt a message's AES GCM key using user's private RSA-OAEP key, and then decrypt content
export async function decryptMessage(
  encryptedContent: string,
  iv: string,
  encryptedAesKey: string,
  privateKeyJwkString: string
): Promise<string> {
  try {
    if (!encryptedAesKey) {
      throw new Error("No encrypted AES key available for current user");
    }

    // 1. Import RSA Private Key
    const privJwk = JSON.parse(privateKeyJwkString);
    const rsaPrivateKey = await window.crypto.subtle.importKey(
      "jwk",
      privJwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["decrypt"]
    );

    // 2. Decrypt encrypted AES GCM key
    const encryptedKeyBuffer = base64ToArrayBuffer(encryptedAesKey);
    const aesRawKeyBuffer = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      rsaPrivateKey,
      encryptedKeyBuffer
    );

    // 3. Import AES-GCM Key
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      aesRawKeyBuffer,
      { name: "AES-GCM" },
      true,
      ["decrypt"]
    );

    // 4. Decrypt original ciphertext content
    const encryptedContentBuffer = base64ToArrayBuffer(encryptedContent);
    const ivBuffer = base64ToArrayBuffer(iv);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
      aesKey,
      encryptedContentBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    console.error("Decryption failed:", err);
    return "🔓 [Decryption Error: Private Key mismatch or missing key share]";
  }
}
