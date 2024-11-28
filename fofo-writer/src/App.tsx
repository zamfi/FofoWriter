import React, { useState } from 'react';
import ScriptCoWriter from './script-cowriter';
import { clearUserState } from './utils/userState'; // Import the clearUserState function

const userId = "admin"; // user ID.(haven't actually implemented loading a different user state depending on userID yet tho

function App() {
  const [showButtonBar, setShowButtonBar] = useState(false); // State to toggle button bar visibility

  // Clear the user state and reload the page
  const handleClearState = () => {
    if (window.confirm("Are you sure you want to clear the user state?")) {
      clearUserState(userId);
      window.location.reload(); // Reload to reset the app state
    }
  };

  // Toggle the visibility of the button bar
  const toggleButtonBar = () => {
    setShowButtonBar((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-pink-200 p-4 relative"> {/* Tailwind class for full-page background */}
      {/* Small Minimize Button */}
      <button
        onClick={toggleButtonBar}
        className="absolute top-2 right-2 p-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm shadow"
        title={showButtonBar ? "Hide Controls" : "Show Controls"}
      >
        {showButtonBar ? "−" : "="}
      </button>

      {/* Button Bar */}
      {showButtonBar && (
        <div className="button-bar flex justify-between items-center mb-4 p-4 bg-gray-100 rounded shadow">
          <span className="text-lg font-semibold">Current User ID: {userId}</span>
          <button
            onClick={handleClearState}
            className="p-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear User State
          </button>
        </div>
      )}

      {/* Main Content */}
      <ScriptCoWriter />
    </div>
  );
}


export default App;
