import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './components/app';
App

export default function decorate(block) {
  // render React components
  const root = createRoot(block);
  root.render(<App />);
}
