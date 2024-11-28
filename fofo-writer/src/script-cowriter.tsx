import React, { useEffect, useReducer, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import OpenAI from "openai";
import { Stream } from 'openai/streaming.mjs';
import { ChatCompletion, ChatCompletionChunk } from 'openai/resources/chat/index.mjs';
import * as PJSON from 'partial-json';

import FoFoChat from './components/FoFoChat';
import ScriptComponentEditor from './components/ScriptComponentEditor';
import Agent from './components/Agent';
import { ConversationState, ScriptState, ScriptEntry } from './types';

import {z} from "zod";
import {zodResponseFormat} from "openai/helpers/zod";

import { loadUserState, saveUserState } from './utils/userState';
const userId = "admin"; // for differentiating between participants vs. us


// const openai = new OpenAI({
//   apiKey: import.meta.env.VITE_OPENAI_API_KEY,dangerouslyAllowBrowser: true 
// });

// ok we need a couple data structures here to define two things.
// 1. the current state of the conversation
// 2. the state of the script in progress

// let's start with the conversation state. these messages can be pretty trivial:
// timestamp, role (assistant vs. user), content.
// we can store these in an array for now.

// // now we can define the conversation state as an array of these messages:
// type ConversationState = Message[];

// // we can also define the Script State as strings with authors (role) and timestamps

// we also need to define the schema for the response from the API. this should allow an array of objects,
// each of which can be a new chat response message or a replacement for a script entry.
// we can use zod for this.

// let's define a schema for the response:

const MessageResponse = z.object({
  type: z.literal("chat"),
  role: z.literal("assistant"),
  message: z.string(),
});

const ScriptResponse = z.object({
  type: z.literal("script"),
  index: z.number(),
  message: z.string(),
});

// the response itself can be an array of these objects:
const ResponsesList = z.object({
  responses: z.array(z.union([MessageResponse, ScriptResponse]))
});

const ChatOnlyResponsesList = z.object({
  responses: z.array(MessageResponse)
});

//Moved Agent class to Agent.ts
//Moved FoFoChat component to FoFoChat.tsx
function useAgent(): {
  agentRef: React.MutableRefObject<Agent | undefined>;
  conversation: ConversationState;
  script: ScriptState;
  dispatch: (action: any) => any;
} {
  const agentRef = useRef<Agent>();

  const initialState = loadUserState(userId);

  const [state, dispatch] = useReducer((state, action) => {
    let newState;

    switch (action.type) {
      case "update_message":
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
        newState = {
          ...state,
          script: [
            ...state.script.slice(0, action.index),
            action.message,
            ...state.script.slice(action.index + 1),
          ],
        };
        break;

      default:
        console.warn("unhandled action type:", action.type);
        newState = state;
    }

    // Save the updated state to localStorage
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
    agentRef: agentRef,
    conversation: state.conversation,
    script: state.script,
    dispatch,
  };
}

// moved ScriptComponentEditor to its own component file

const ScriptCoWriter = () => {
  const {agentRef, conversation, script, dispatch} = useAgent();
  const [currentInput, setCurrentInput] = useState(0);
  const [agentActive, setAgentActive] = useState(false);

  const fofoHandleEvent = async (type: string, data: any) => {
    try {
      setAgentActive(true);
      switch (type) {
        case "user-message":
          agentRef?.current?.handleUserChat(data);
          break;
        case "user-completed-script-entry": {
          console.log("fofo is handling the script entry");
          await agentRef?.current?.handleScriptUpdate(data);
          const nextCurrentInput = script.findIndex(o => o.role === "user" && o.content.trim().length === 0);
          setCurrentInput(nextCurrentInput);
          if (nextCurrentInput === -1) {
            setCurrentInput(script.length);
            // add a new blank entry too
            dispatch({
              type: "update_script",
              index: script.length,
              message: {
                timestamp: Date.now(),
                role: script.length % 2 == 0 ? "user" : "assistant",
                content: ""
              }
            });
          }
          break;
        }
        case "request-regenerate-script-entry":
          agentRef?.current?.regenerateScriptEntry(data);
          break;
        default:
          console.warn("unhandled event type:", type);
      }
    } finally {
      setAgentActive(false);
    }
  }

  // const handleRegenerate = (index: number) => {
  //   const previousUserInput = inputs[index - 1];
  //   const suggestions = generateAIResponse(previousUserInput);
  //   const currentSuggestion = inputs[index];
  //   const currentIndex = suggestions.indexOf(currentSuggestion);
  //   const nextIndex = (currentIndex + 1) % suggestions.length;
    
  //   const newInputs = [...inputs];
  //   newInputs[index] = suggestions[nextIndex];
  //   setInputs(newInputs);
  // };

  const updateContent = (index: number, content: string) => {
    dispatch({
      type: "update_script",
      index: index,
      message: {
        ...(script[index] || {}),
        content: content
      }
    });
  }

// User hits enter while in the script writing section
  const handleEntryComplete = (index: number) => {
    dispatch({
      type: "update_script",
      index: index,
      message: {
        ...(script[index] || {}),
        timestamp: Date.now()
      }
    });
    fofoHandleEvent("user-completed-script-entry", {index, content: script[index]?.content});
  }

  //User clicks the regenerate button next to a script entry
  const requestRegenerate = (index: number) => {
    fofoHandleEvent("request-regenerate-script-entry", {index});
  }
  
  //User chats in the chat zone
  const handleUserChat = (userMessage: string) => {
    fofoHandleEvent("user-message", userMessage);
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-8 min-h-[600px] bg-green-50 rounded-lg flex gap-8">
      {/* Left Side */}
      <div className="w-1/3">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Today's Task:</h1>
          <p className="text-lg mb-4">
            Write a script for a social media video advertising a bake sale fundraiser event for{' '}
            <span className="underline">Local Community School</span>.
          </p>
        </div>
        
        <div className="relative">
          <FoFoChat handleUserChat={handleUserChat} conversation={conversation} script={script} disabled={agentActive} />
          {/*-- defines fofo for now, TODO: replace with image of fofo */ }
          <div className="w-32 h-32 bg-blue-400 rounded-full relative">
            <div className="absolute top-1/4 left-1/4 w-6 h-6 bg-white rounded-full border-2 border-black"></div>
            <div className="absolute top-1/4 right-1/4 w-6 h-6 bg-white rounded-full border-2 border-black"></div>
            <div className="absolute bottom-1/4 left-1/2 w-8 h-4 bg-black rounded-full -translate-x-1/2"></div>
          </div>
        </div>
      </div>

      {/* Right Side */}
      <div className="flex-1">
        <h2 className="text-xl font-semibold mb-6">Your Turn:</h2>
        
        <div className="space-y-4">
          {/* here is where the script appears */}
          {script.map((entry, index) => (
            <ScriptComponentEditor
              key={entry.timestamp} // Use a unique property like timestamp or id
              index={index}
              disabled={agentActive || index !== currentInput}
              showInstructions={!agentActive && index === currentInput}
              content={entry || ''}
              updateContent={(content: string) => updateContent(index, content)}
              handleEntryComplete={() => handleEntryComplete(index)}
              requestRegenerate={() => requestRegenerate(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScriptCoWriter;

