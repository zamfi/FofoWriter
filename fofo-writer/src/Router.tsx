import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import App from './App.tsx';

// Define a function to parse the binary route
const parseRoute = (route: string) => {
  // Ensure the binary string is valid
  // if (!/^[01]{3}\/P\d{2,}$/.test(route)) {
  //   return { sycophantic: false, task_condition: 'default', fofo_name: 'FoFo', user_id: 'admin' }; // Default config
  // }

  // Map binary digits to configuration
  const configParts = route.split('/');

  if (configParts.length < 2) {
    return { sycophantic: false, task_condition: 'default', fofo_name: 'FoFo', user_id: 'admin' }; // Default config
  }


  const [sycophanticBit, taskConditionBit, fofoNameBit] = configParts[0].split('').map(Number);
  const user_id = configParts[1];

  // @ts-expect-error - Manually setting global condition data

  const conditionData = window.conditionData = {
    sycophantic: sycophanticBit === 0,
    task_condition: taskConditionBit === 0 ? 'bake sale' : 'potluck',
    fofo_name: fofoNameBit === 0 ? 'FoFo' : 'FuFu',
    user_id
  }

  return conditionData;
};

const Router: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract the path segment after '/'
  const pathKey = location.pathname.slice(1);

  // Parse the config based on the binary route
  const config = parseRoute(pathKey);

  // Redirect unknown paths to a default route
  React.useEffect(() => {
    if (!/^[01]{3}\/(P\d{2,}|admin)$/.test(pathKey)) {
      navigate('/000/admin'); // Redirect to default path
    }
  }, [pathKey, navigate]);

  return (
    <App
      sycophantic={config.sycophantic}
      task_condition={config.task_condition}
      fofo_name={config.fofo_name}
      user_id={config.user_id}
    />
  );
};

export default Router;
