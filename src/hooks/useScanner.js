/**
 * useScanner - Hook skeleton for Scanner page logic.
 *
 * Purpose: extract state, side-effects and API calls from `src/pages/Scanner.jsx`
 * into a testable, well-documented hook. This file is a non-invasive starter
 * that lists the public API expected by the page. Implementations can be
 * incrementally moved here.
 */
import { useState, useCallback } from 'react';

export default function useScanner() {
  const [scanning, setScanning] = useState(false);
  const [matchedPlant, setMatchedPlant] = useState(null);
  const [allScanResults, setAllScanResults] = useState([]);

  const identifyPlant = useCallback(async (file, organ = 'auto') => {
    setScanning(true);
    try {
      // TODO: move identifyPlant flow here (upload, function invoke, result parsing)
    } catch (err) {
      console.error('identifyPlant error', err);
    } finally {
      setScanning(false);
    }
  }, []);

  const reset = useCallback(() => {
    setMatchedPlant(null);
    setAllScanResults([]);
    setScanning(false);
  }, []);

  return {
    scanning,
    matchedPlant,
    allScanResults,
    identifyPlant,
    reset,
    // add other functions/values as we extract them from Scanner.jsx
  };
}
