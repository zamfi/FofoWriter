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

// ==== pass selections set via the url route + Router to the App ===== //
interface AppProps {
  sycophantic: boolean;
  task_condition: string;
  fofo_name: string;
  user_id: string;
}

// ====== use Agent function to set up our agent for the app ====== //

function useAgent(user_id: string, sycophantic: boolean, task_condition: string): {
  agentRef: React.MutableRefObject<Agent | undefined>;
  conversation: ConversationState;
  script: ScriptState;

  // sycophantic: boolean;
  // task_condition: string;
  dispatch: (action: any) => any;
} {
  const agentRef = useRef<Agent>();
  const initialState = loadUserState(user_id) || { conversation: [], script: [], challenge_over: false};

  const [state, dispatch] = useReducer((state: { conversation: any[]; script: any[]; challenge_over: boolean;}, action: { type: any; index: number; message: any; }) => {
    let newState;

    switch (action.type) {
      case "update_message":

        console.log("updating UI for new chat message!! **App.tsx**");
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
        console.log("script update", state, newState, action);
        break;
      
      //TODO case "regenerate":

      default:
        console.warn("Unhandled action type:", action.type);
        newState = state;
    }

    // Save state to localStorage
    saveUserState(user_id, newState);

    return newState || state;
  }, initialState);

  
  useEffect(() => {
    if (!agentRef.current) {
      window.agent = agentRef.current = new Agent(sycophantic, task_condition, user_id);
    }
    agentRef.current.updateDispatch({ ...state, sycophantic, task_condition }, dispatch);
  }, [state]);

  return {
    agentRef,
    conversation: state.conversation,
    script: state.script,
    dispatch,
  };
}

/*-- export user conversation and script as a .txt file function --*/
function exportUserData(user_id: string) {
  const userData = loadUserState(user_id);
  const dataStr = JSON.stringify(userData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `userData-${user_id}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ====== main app component ====== //

const App: React.FC<AppProps> = ({ sycophantic, task_condition, fofo_name, user_id }) => {
  const { agentRef, conversation, script, dispatch } = useAgent(user_id, sycophantic, task_condition);
  const [agentActive, setAgentActive] = useState(false);
  const [showButtonBar, setShowButtonBar] = useState(false);
  const [newUserId, setNewUserId] = useState(user_id);


  // @ts-expect-error - Manually getting global condition data
  console.log("app rendering with", window.conditionData);
  

  const handleUserChat = async (userMessage: string) => {
    console.log("handleUserChat **App.tsx --> Agent.tsx**");
    if (agentRef.current) {
      setAgentActive(true);
      await agentRef.current.handleUserChat(userMessage);
      setAgentActive(false);
    }
  };

  const handleClearState = () => {
    if (window.confirm("Are you sure you want to start over? All progress will be lost.")) {
      clearUserState(user_id);
      window.location.reload(); // Reload to reset the app state
    }
  };

  const toggleButtonBar = () => {
    setShowButtonBar((prev) => !prev);
  };

  const handleUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewUserId(e.target.value);
  };

  const handleUserIdSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const currentPath = window.location.pathname.split('/')[1]; // Get the current binary route part
    window.location.href = `/${currentPath}/${newUserId}`; // Change the URL to update the user_id
  };



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
          <span className="text-md font-semibold">S?: {sycophantic? "True" : "False"} | Task: {task_condition} | Agent: {fofo_name} </span>
          <button
            onClick={handleClearState}
            className="p-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear History
          </button>
          <button
            onClick={() => exportUserData(user_id)}
            className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Export Data
          </button>

          <form onSubmit={handleUserIdSubmit} className="flex items-center">
            <input
              type="text"
              value={newUserId}
              onChange={handleUserIdChange}
              className="p-2 border rounded mr-2"
              placeholder="Enter new user ID"
            />
            <button
              type="submit"
              className="p-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Change User ID
            </button>
          </form>
        </div>
      )}

      {/*---  Main Content ---*/}

      {/* Task Description Section */}
      <div className="bg-white rounded-lg shadow p-4 m-10 mt-3 mb-5 p-10">
        <h2 className="text-2xl font-sans font-bold mb-2">TASK:</h2>
        <p className="text-md font-sans whitespace-pre-line">
          Write a script for a social media video to advertise an upcoming  
          {task_condition === "bake sale" ? (
            <span dangerouslySetInnerHTML={{ __html: ` bake sale fundraiser for the Berkeley Public School District. Various baked goods will be brought in by members of the PTO. <br> <strong> Time & Date:</strong> Sunday, December 15, 2024 from 1-4PM <br> <strong> Location:</strong> Berkeley High School: 1980 Allston Way, Berkeley, CA 94704.` }} />
          ) 
          : 
          (
            <span dangerouslySetInnerHTML={{ __html: ` local community potluck and food drive. Participants should consider bringing a dish and/or nonperishable food to donate to the Berkeley Food Bank. <br> <strong> Time & Date:</strong> Friday, December 20, 2024 from 5-8PM <br> <strong> Location: </strong> Martin Luther King Jr. Civic Center Park: 2180 Milvia St, Berkeley, CA 94704.` }} />

          )}
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
            fofo_name={fofo_name}
            disabled={agentActive}
            user_id={user_id}
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
            user_id={user_id}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
