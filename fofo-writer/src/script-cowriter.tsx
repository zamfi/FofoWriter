import React, { useEffect, useState, useRef} from 'react';

import ScriptComponentEditor from './components/ScriptComponentEditor';
import { ConversationState, ScriptState } from './types';


//Moved Agent class to Agent.ts
//Moved FoFoChat component to FoFoChat.tsx
//Moved useAgent function to App.tsx

interface ScriptCoWriterProps {
  script: ScriptState;
  dispatch: (action: any) => void;
  agentActive: boolean;
  conversation: ConversationState;
  setAgentActive: (active: boolean) => void;
  agentRef: React.MutableRefObject<any>;
}





const ScriptCoWriter: React.FC<ScriptCoWriterProps> = ({ script, dispatch, agentActive, setAgentActive, agentRef }) => {
  const [currentInput, setCurrentInput] = useState(0);
  const scriptContainerRef = useRef<HTMLDivElement>(null);


 
  useEffect(() => {
    // Ensure there's always a blank entry at the end of the script
    if (script[script.length - 1]?.content?.trim() !== '') {
      dispatch({
        type: 'update_script',
        index: script.length,
        message: {
          timestamp: Date.now(),
          role: script.length % 2 === 0 ? 'user' : 'assistant',
          content: '',
        },
      });
    }
  
    // Scroll to the bottom of the script container
    if (scriptContainerRef.current) {
      const { scrollHeight, clientHeight } = scriptContainerRef.current;
      scriptContainerRef.current.scrollTop = scrollHeight - clientHeight;
    }
  }, [script, dispatch]);
  


  
  const handleEntryComplete = async (index: number) => {
    console.log('handleEntryComplete called for index:', index);
    const userEntry = script[index]?.content || '';

    if (!userEntry.trim()) {
      console.warn('User input is empty, skipping...');
      return;
    }

    dispatch({
      type: 'update_script',
      index,
      message: {
        ...(script[index] || {}),
        role: "user",
        timestamp: Date.now(),
        content: userEntry,
      },
    });

    console.log('Dispatched user input, notifying agent.');

    // Notify agent to process the script entry
    setAgentActive(true);
    try {
      //const nextCurrentInput = script.findIndex((entry) => entry.role === 'user' && entry.content.trim() === '');
      if (agentRef.current) {
        const response = await agentRef.current.handleScriptUpdate({
          index,
          content: userEntry,//script[index]?.content || '',
        });

        //setCurrentInput(nextCurrentInput !== -1 ? nextCurrentInput : script.length);

        if (response) {
          // Add a new blank script entry
          dispatch({
            type: "update_script",
            index: index + 1,
            message: {
              timestamp: Date.now(),
              role: "assistant", //script.length % 2 === 0 ? "user" : "assistant",
              content: "",
            },
          });
          console.log('Added new blank script entry.');
          setCurrentInput(index + 2); // Move focus to the blank entry
        }
      }
    } finally {
      setAgentActive(false);
    }
  };

  const updateContent = (index: number, content: string) => {
    //console.log('updateContent called for index:', index, 'with content:', content);
    dispatch({
      type: "update_script",
      index,
      message: {
        ...(script[index] || {}),
        content,
      },
    });
  };

  const requestRegenerate = (index: number) => {
    if (agentRef.current) {
      setAgentActive(true);
      agentRef.current
        .regenerateScriptEntry({ index })
        .finally(() => setAgentActive(false));
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-8 min-h-[600px] bg-gray-200 rounded-lg">
      <h2 className="font-serif mb-2">Type your script below...</h2>
      <div className="space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto bg-white p-4 m-4 border border-gray-300 rounded-lg"
      ref={scriptContainerRef} // Reference for scrolling to the bottom
      >
        {script.map((entry, index) => (
          <ScriptComponentEditor
            key={`${index}-${entry.timestamp}`}
            index={index}
            disabled={false}
            showInstructions={!agentActive && index === currentInput}
            content={entry || ''}
            updateContent={(content: string) => updateContent(index, content)}
            handleEntryComplete={() => handleEntryComplete(index)}
            requestRegenerate={() => requestRegenerate(index)}
          />
        ))}
      </div>
    </div>
  );
};

export default ScriptCoWriter;

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

 


// import { RotateCcw } from 'lucide-react';
// import OpenAI from "openai";
// import { Stream } from 'openai/streaming.mjs';
// import { ChatCompletion, ChatCompletionChunk } from 'openai/resources/chat/index.mjs';
// import * as PJSON from 'partial-json';

// import {z} from "zod";
// import {zodResponseFormat} from "openai/helpers/zod";

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

// const MessageResponse = z.object({
//   type: z.literal("chat"),
//   role: z.literal("assistant"),
//   message: z.string(),
// });

// const ScriptResponse = z.object({
//   type: z.literal("script"),
//   index: z.number(),
//   message: z.string(),
// });

// // the response itself can be an array of these objects:
// const ResponsesList = z.object({
//   responses: z.array(z.union([MessageResponse, ScriptResponse]))
// });

// const ChatOnlyResponsesList = z.object({
//   responses: z.array(MessageResponse)
// });
