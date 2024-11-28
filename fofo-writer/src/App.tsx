import React, { useEffect, useReducer, useRef, useState } from 'react';
import ScriptCoWriter from './script-cowriter';
import FoFoChat from './components/FoFoChat';
import { ConversationState, ScriptState} from './types';
import { clearUserState, loadUserState, saveUserState } from './utils/userState';
import Agent from './components/Agent'; // Import Agent class

// Extend the Window interface to include the agent property
declare global {
  interface Window {
    agent: Agent | undefined;
  }
}


const userId = "admin"; // Example user ID; replace with dynamic logic as needed


function useAgent(userId: string): {
  agentRef: React.MutableRefObject<Agent | undefined>;
  conversation: ConversationState;
  script: ScriptState;
  dispatch: (action: any) => any;
} {
  const agentRef = useRef<Agent>();
  const initialState = loadUserState(userId) || { conversation: [], script: [] };

  const [state, dispatch] = useReducer((state: { conversation: any[]; script: any[]; }, action: { type: any; index: number; message: any; }) => {
    let newState;

    switch (action.type) {
      case "update_message":
        //console.log("updating UI for new chat message!! (App.tsx)");
        newState = {
          ...state,
          conversation: [
            ...state.conversation.slice(0, action.index),
            action.message,
            ...state.conversation.slice(action.index + 1),
          ],
        };
        break;

      case "update_script":
        //console.log("updating UI for new script lines!! (App.tsx)");
        newState = {
          ...state,
          script: [
            ...state.script.slice(0, action.index),
            action.message,
            ...state.script.slice(action.index + 1),
          ],
        };
        break;
      
      //TODO case "regenerate":

      default:
        console.warn("Unhandled action type:", action.type);
        newState = state;
    }

    // Save state to localStorage
    saveUserState(userId, newState);

    return newState;
  }, initialState);

  
  useEffect(() => {
    if (!agentRef.current) {
      window.agent = agentRef.current = new Agent();
    }
    agentRef.current.updateDispatch(state, dispatch);
  }, [state]);

  return {
    agentRef,
    conversation: state.conversation,
    script: state.script,
    dispatch,
  };
}

function App() {
  const { agentRef, conversation, script, dispatch } = useAgent(userId);
  const [agentActive, setAgentActive] = useState(false);

  const handleUserChat = async (userMessage: string) => {
    console.log("handleUserChat **App.tsx**");
    if (agentRef.current) {
      setAgentActive(true);
      await agentRef.current.handleUserChat(userMessage);
      setAgentActive(false);
    }
  };

  const handleClearState = () => {
    if (window.confirm("Are you sure you want to clear the user state?")) {
      clearUserState(userId);
      window.location.reload(); // Reload to reset the app state
    }
  };

  const toggleButtonBar = () => {
    setShowButtonBar((prev) => !prev);
  };

  const [showButtonBar, setShowButtonBar] = useState(false);

  return (
    <div className="min-h-screen bg-pink-200 p-4 relative">
      {/* Small Minimize Button */}
      <button
        onClick={toggleButtonBar}
        className="absolute top-2 right-2 p-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm shadow"
        title={showButtonBar ? "Hide Controls" : "Show Controls"}
      >
        {showButtonBar ? "−" : "+"}
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

      {/*---  Main Content ---*/}

      {/* Task Description Section */}
      <div className="bg-white rounded-lg shadow p-4 m-10 mt-3 mb-5 p-10">
        <h2 className="text-2xl font-sans font-bold mb-2">TASK:</h2>
        <p className="text-2xl font-sans">
          Write a script for a social media video to advertise an upcoming bake sale fundraiser for the Berkeley Public School District.
        </p>
      </div>

      {/* Chatbox and Script Section */}
      <div className="flex gap-8">
        {/* Chatbox Section */}
        <div className="w-1/3 bg-gray-100 rounded-lg shadow p-4 max-h-[600px] overflow-y-auto">
          <FoFoChat
            handleUserChat={handleUserChat}
            conversation={conversation}
            script={script} // Pass script if needed
            disabled={agentActive}
          />
        </div>

        {/* Script Section */}
        <div className="flex-1 ">
          <ScriptCoWriter
            conversation={conversation}
            script={script}
            dispatch={dispatch}
            agentRef={agentRef}
            agentActive={agentActive}
            setAgentActive={setAgentActive}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
