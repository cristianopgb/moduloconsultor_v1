import React from 'react';
import { StableCanvas } from './components/StableCanvas';

const App: React.FC = () => {
  return (
    <div className="App">
      <h1>Canvas Refactor App</h1>
      <StableCanvas />
    </div>
  );
};

export default App;