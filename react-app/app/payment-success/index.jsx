import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/app';
import './index.css';

export default function decorate(block) {
  // render React components
  const root = createRoot(block);
  root.render(<App />);
}
