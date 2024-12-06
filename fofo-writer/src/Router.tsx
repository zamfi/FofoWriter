import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import App from './App.tsx';

// Define a function to parse the binary route
const parseBinaryRoute = (binary: string) => {
  // Ensure the binary string is valid
  if (!/^[01]{3}$/.test(binary)) {
    return { sycophantic: false, task_condition: 'default', fofo_name: 'FoFo' }; // Default config
  }

  // Map binary digits to configuration
  const [sycophanticBit, taskConditionBit, fofoNameBit] = binary.split('').map(Number);

  return {
    sycophantic: sycophanticBit === 0,
    task_condition: taskConditionBit === 0 ? 'bake sale' : 'potluck',
    fofo_name: fofoNameBit === 0 ? 'FoFo' : 'FuFu',
  };
};

const Router: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract the path segment after '/'
  const pathKey = location.pathname.replace('/', '').toLowerCase();

  // Parse the config based on the binary route
  const config = parseBinaryRoute(pathKey);

  // Redirect unknown paths to a default route
  React.useEffect(() => {
    if (!/^[01]{3}$/.test(pathKey)) {
      navigate('/000'); // Redirect to default path
    }
  }, [pathKey, navigate]);

  return (
    <App
      sycophantic={config.sycophantic}
      task_condition={config.task_condition}
      fofo_name={config.fofo_name}
    />
  );
};

export default Router;
