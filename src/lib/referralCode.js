const REFERRAL_CODE_SALT = "floralog-referral-v1";

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4 || 4)) % 4;
  const padded = normalized + "=".repeat(paddingLength);
  const binary = window.atob(padded);

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function scrambleBytes(bytes) {
  const saltBytes = new TextEncoder().encode(REFERRAL_CODE_SALT);
  return bytes.map((byte, index) => byte ^ saltBytes[index % saltBytes.length] ^ ((index * 31 + 17) & 0xff));
}

export function encodeReferralCode(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return "";

  const emailBytes = new TextEncoder().encode(normalizedEmail);
  return toBase64Url(scrambleBytes(emailBytes));
}

export function decodeReferralCode(referralCode) {
  if (!referralCode) return null;

  try {
    const decodedBytes = fromBase64Url(referralCode);
    const plainText = new TextDecoder().decode(scrambleBytes(decodedBytes)).trim().toLowerCase();
    return plainText.includes("@") ? plainText : null;
  } catch {
    return null;
  }
}

export function resolveReferralEmail(referralCode) {
  const decodedReferralCode = decodeReferralCode(referralCode);
  if (decodedReferralCode) return decodedReferralCode;

  try {
    const legacyValue = decodeURIComponent(referralCode).trim().toLowerCase();
    return legacyValue.includes("@") ? legacyValue : null;
  } catch {
    return null;
  }
}