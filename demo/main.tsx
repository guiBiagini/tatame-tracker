import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../src/entrypoints/sidepanel/App';
import '../src/entrypoints/sidepanel/style.css';
import './demo.css';
import { resetDemo, seedIfEmpty } from './seed';

document.getElementById('reset')!.addEventListener('click', () => resetDemo().then(() => location.reload()));

seedIfEmpty().then(() =>
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  ),
);
