import React from 'react';
import { Canvas } from './Canvas';

export default {
  title: 'Components/Canvas',
  component: Canvas,
};

const Template = (args) => <Canvas {...args} />;

export const Default = Template.bind({});
Default.args = {
  // Add default props for the Canvas component here
};

export const WithCustomSize = Template.bind({});
WithCustomSize.args = {
  width: 800,
  height: 600,
};

export const WithBackgroundColor = Template.bind({});
WithBackgroundColor.args = {
  backgroundColor: '#f0f0f0',
};