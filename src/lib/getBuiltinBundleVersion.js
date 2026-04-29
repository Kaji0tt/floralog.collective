// Reads the built-in bundle-version.json from the public folder (copied into the APK)
export async function getBuiltinBundleVersion() {
  try {
    const response = await fetch('bundle-version.json', { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    return data.version || null;
  } catch (e) {
    return null;
  }
}
