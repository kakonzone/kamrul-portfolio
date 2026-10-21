import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { initFx } from './fx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Progressive enhancement gate. Cheap (calm) is the default; `.fx-on` is added
// only after a capability check + frame probe passes. Runs after mount so it
// never blocks first paint.
initFx();