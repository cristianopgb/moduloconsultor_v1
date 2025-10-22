import React from 'react';
import { render, screen } from '@testing-library/react';
import StableCanvas from './StableCanvas';

describe('StableCanvas', () => {
  test('renders without crashing', () => {
    render(<StableCanvas />);
    const canvasElement = screen.getByTestId('stable-canvas');
    expect(canvasElement).toBeInTheDocument();
  });

  test('should maintain layout stability', () => {
    render(<StableCanvas />);
    const canvasElement = screen.getByTestId('stable-canvas');
    expect(canvasElement).toHaveStyle('position: relative'); // Example style check
  });

  // Add more tests as needed to ensure functionality and stability
});