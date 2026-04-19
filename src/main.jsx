// React entry point. Vite loads this from index.html as a module script.
// Mounts <App /> into the #root div and pulls in the base stylesheet.

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/setup.css'

// StrictMode double-invokes some lifecycle stuff in dev to catch side-effect
// bugs. It's stripped out of production builds, so no runtime cost.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
