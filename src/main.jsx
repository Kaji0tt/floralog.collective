import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>,
)

const setDynamicViewportHeight = () => {
  const vv = window.visualViewport;
  const height = vv?.height || window.innerHeight;
  document.documentElement.style.setProperty('--app-dvh', `${Math.round(height)}px`);
};

setDynamicViewportHeight();
window.addEventListener('resize', setDynamicViewportHeight);
window.addEventListener('orientationchange', setDynamicViewportHeight);
window.visualViewport?.addEventListener('resize', setDynamicViewportHeight);
window.visualViewport?.addEventListener('scroll', setDynamicViewportHeight);

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}



