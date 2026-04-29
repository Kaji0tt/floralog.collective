import { useState } from 'react';

// Liest die OTA-Logs aus window.OTA_DEBUG_LOGS
export default function OtaDebugConsole() {
  const [open, setOpen] = useState(false);
  const logs = Array.isArray(window.OTA_DEBUG_LOGS) ? window.OTA_DEBUG_LOGS : [];



  return (
    <>
      {!open && (
        <button
          style={{position: 'fixed', bottom: 16, right: 16, zIndex: 9999, background: '#222', color: '#fff', borderRadius: 24, padding: '8px 16px', opacity: 0.7}}
          onClick={() => setOpen(true)}
        >OTA Debug</button>
      )}
      {open && (
        <div style={{position: 'fixed', bottom: 0, right: 0, left: 0, maxHeight: '60vh', background: '#18181b', color: '#fff', zIndex: 10000, borderTop: '2px solid #16a34a', overflowY: 'auto', fontSize: 12, padding: 12}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <strong>OTA Debug Console</strong>
            <button onClick={() => setOpen(false)} style={{background: 'none', color: '#fff', border: 'none', fontSize: 16}}>✕</button>
          </div>
          <pre style={{whiteSpace: 'pre-wrap'}}>
            {logs.length === 0 ? 'Keine OTA-Logs.' : logs.map((l, i) => `[${l.time}] ${l.msg}\n`).join('')}
          </pre>
        </div>
      )}
    </>
  );
}