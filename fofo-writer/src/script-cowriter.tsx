import React, { useEffect, useReducer, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import OpenAI from "openai";
import { Stream } from 'openai/streaming.mjs';
import { ChatCompletion, ChatCompletionChunk } from 'openai/resources/chat/index.mjs';
import * as PJSON from 'partial-json';

import {z} from "zod";
import {zodResponseFormat} from "openai/helpers/zod";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,dangerouslyAllowBrowser: true 
});

// ok we need a couple data structures here to define two things.
// 1. the current state of the conversation
// 2. the state of the script in progress

// let's start with the conversation state. these messages can be pretty trivial:
// timestamp, role (assistant vs. user), content.
// we can store these in an array for now.

// let's define a type for this:
type Message = {
  timestamp: number;
  role: "assistant" | "user" | "system";
  content: string;
};

// now we can define the conversation state as an array of these messages:
type ConversationState = Message[];

// we can also define the script state as strings with authors (role) and timestamps
type ScriptEntry = {
  timestamp: number;
  role: "assistant" | "user";
  content: string;
};

type ScriptState = ScriptEntry[];

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

// type ResponsesList = z.infer<typeof ResponsesList>;

// now we need an agent to define the behavior of the assistant.
// this agent will track the conversaion state and the script state.
// some functionality is key:
// 1. it will be able to take a new chat message from the user and generate a response (streaming, vis a socket, from the server)
// 2. it will be able to generate a "next" entry in the script state based on the existing conversation and script states (streaming via socket, from the server), followed and/or preceeded by commentary on the generated script entry as a conversation message.
// 3. it will be able to update an entry in the script on user request (streaming via socket, from the server) followed and/or preceeded by commentary on the updated script entry as a conversation message.


// a helper to aggregate chunks into a single message:
function aggregateChunks(base: ChatCompletion.Choice, chunks: ChatCompletionChunk.Choice[]): ChatCompletion.Choice {
  return chunks.reduce<ChatCompletion.Choice>((acc: ChatCompletion.Choice, chunk) => {
    return {
      ...(acc || {}),
      ...chunk,
      message: {
        role: chunk.delta.role || acc?.message?.role,
        content: (acc?.message?.content || '') + (chunk?.delta?.content || ''),
        ...(acc?.message?.tool_calls || chunk?.delta?.tool_calls ? {
          tool_calls: chunk?.delta?.tool_calls?.reduce((acc, toolCall) => {
            acc[toolCall.index] = {
              ...acc[toolCall.index],
              function: {
                arguments: (acc[toolCall.index]?.function?.arguments || '') + (toolCall.function?.arguments || ''),
                name: (acc[toolCall.index]?.function?.name || '') + (toolCall.function?.name || '')
              }
            };
            return acc;
          }, acc?.message?.tool_calls || [])
        } : {})
      }
    };
  }, base);
}

type ChoiceChunk = {
  chunk: ChatCompletionChunk.Choice;
  aggregated: ChatCompletion.Choice;
}

// let's define the agent as a class:
class Agent {
  state: {conversation: ConversationState, script: ScriptState};
  dispatch: (action: any) => any;
  constructor() {
    this.state = {conversation: [], script: []};
    this.dispatch = (action) => {};
  }

  updateDispatch(state, dispatch) {
    this.state = state;
    this.dispatch = dispatch;
  }

  // let's define a "callLLM" method that will take in a list of openai messages and return the structured
  // data response from the API.
  async callLLM(messages: Message[], responseSchema, chunk_cb?: (chunk: ChoiceChunk) => void): Promise<ChatCompletion.Choice | null> {
    const stream = chunk_cb !== undefined;
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        stream,
        ...(responseSchema ? {response_format: zodResponseFormat(responseSchema, "response")} : {})
      });
      if (stream) {
        let aggregatedCompletion = {} as ChatCompletion.Choice;
        for await (const chunk of (completion as Stream<ChatCompletionChunk>)) {
          aggregatedCompletion = aggregateChunks(aggregatedCompletion, [chunk?.choices?.[0]]);
          chunk_cb({
            chunk: chunk?.choices?.[0],
            aggregated: aggregatedCompletion
          });
        }
        return aggregatedCompletion;
      } else {
        return (completion as ChatCompletion)?.choices[0];
      }
    } catch (error) {
      console.error("Error generating AI response:", error);
      return null; // ["Sorry, I couldn't process that. Please try again."];
    }
  }

  handleResponses(chatIndex=this.state.conversation.length, responses) {
    for (const response of responses) {
      if (response.type === "chat") {
        this.dispatch({
          type: "update_message",
          index: chatIndex++, // increment the chat index for each new message
          message: {
            timestamp: Date.now(),
            role: response.role,
            content: response.message
          }
        });
      } else if (response.type === "script") {
        // console.log("updating script with", response);
        if ('message' in response) {
          this.dispatch({
            type: "update_script",
            index: response.index,
            message: {
              timestamp: Date.now(),
              role: "assistant",
              content: response.message
            }
          });
        }
      }
    }
  }

  handleInterimResponses(chatIndex:number, chunk: ChoiceChunk) {
    const responsesSoFar = PJSON.parse(chunk?.aggregated?.message?.content || '{}')?.responses;
    if (! responsesSoFar) {
      return;
    }

    this.handleResponses(chatIndex, responsesSoFar);    
  }

  static systemMessages = {
    "chat": { 
      timestamp: Date.now(), 
      role: 'system', 
      content: 
`You are a very talented scriptwriter bot! You are having a conversation with a user to help them write a script for a social media video advertising a bake sale fundraiser event for a local community school. The user and you will alternate sentences in the script, with the user going first. You can also provide feedback on the user's sentences and suggest improvements, and the user may make requests of you as well. 

You will be responsible for the odd-indexed sentences in the script, and the user will be responsible for the even-indexed sentences. You will also be responsible for providing feedback on the user's sentences and suggesting improvements.

UNLESS EXPLICITLY REQUESTED LATER ON, DO NOT ADD OR UPDATE ANY SCRIPT ITEMS PAST THE USER'S LAST ENTRY.

Be kind and as concise as possible!`
    } as Message,
    "scriptUpdated": { 
      timestamp: Date.now(), 
      role: 'system', 
      content: 
`You are a very talented scriptwriter bot! You are having a conversation with a user to help them write a script for a social media video advertising a bake sale fundraiser event for a local community school. The user and you will alternate sentences in the script, with the user going first. You can also provide feedback on the user's sentences and suggest improvements, and the user may make requests of you as well. 

You will be responsible for the odd-indexed sentences in the script, and the user will be responsible for the even-indexed sentences. You will also be responsible for providing feedback on the user's sentences and suggesting improvements.

THE USER HAS JUST UPDATED A SCRIPT ITEM. IT MAY BE YOUR TURN TO ADD A NEW ITEM, BUT ONLY IF THERE IS A BLANK ITEM AFTER THE USER'S LAST ENTRY.

Be kind and as concise as possible!`
    } as Message,
  }

  // let's define a "handleUserChat" method that will take in a user message and generate a response
  // from the assistant.
  async handleUserChat(userContent: string) {
    // first track where the assistant chats should go
    const nextChatsAtIndex = this.state.conversation.length + 1;
    
    // let's construct the user message object first
    const userMessage = { timestamp: Date.now(), role: 'user', content: userContent } as Message;

    // let's include the current state of the script too
    const scriptMessage = {
      timestamp: Date.now(),
      role: 'system',
      content: [
        "Here's the current script, btw:",
        JSON.stringify({script: this.state.script.map((o, i) => ({...o, index: i}))}, null, 2),
        "IF IT IS ALL BLANK DO NOT TOUCH THE SCRIPT."
      ].join("\n\n")
    }

    // then cache the set of messages to send to the API
    const llmMessages = [Agent.systemMessages.chat, ...this.state.conversation, userMessage, scriptMessage];

    // we need to add the user message to the conversation
    this.dispatch({
      type: "update_message",
      index: this.state.conversation.length,
      message: userMessage
    });
    // we need to generate a response
    console.log("LLM being called with messages", llmMessages);
    const choice = await this.callLLM(
      llmMessages, 
      this.state.script.some(o => o.content.trim().length > 0) ? ResponsesList : ChatOnlyResponsesList,
      (chunk) => {
        this.handleInterimResponses(nextChatsAtIndex, chunk);
      });
    // finally, commit the aggregated responses
    const responses = JSON.parse(choice?.message?.content || "{}").responses;
    console.log("final responses:", responses);
    // we need to add the response to the conversation
    this.handleResponses(nextChatsAtIndex, responses);
  }

  async handleScriptUpdate({index, content} : {index: number, content: string}) {
    // first track where the assistant chats should go
    const nextChatsAtIndex = this.state.conversation.length;
    
    // let's include the current state of the script
    const scriptMessage = {
      timestamp: Date.now(),
      role: 'system',
      content: [
        "Here's the current script, btw:",
        JSON.stringify({script: this.state.script.map((o, i) => ({...o, index: i}))}, null, 2),
        `The user just changed the item at index ${index} to read "${content}".`,
      ].join("\n\n")
    }

    // then cache the set of messages to send to the API
    const llmMessages = [Agent.systemMessages.scriptUpdated, ...this.state.conversation, scriptMessage];

    // we need to generate a response
    console.log("LLM being called with messages", llmMessages);
    const choice = await this.callLLM(
      llmMessages, 
      this.state.script.some(o => o.content.trim().length > 0) ? ResponsesList : ChatOnlyResponsesList,
      (chunk) => {
        this.handleInterimResponses(nextChatsAtIndex, chunk);
      });
    // finally, commit the aggregated responses
    const responses = JSON.parse(choice?.message?.content || "{}").responses;
    console.log("final responses:", responses);
    // we need to add the response to the conversation
    this.handleResponses(nextChatsAtIndex, responses);
  }
}

function useAgent(): {
  agentRef: React.MutableRefObject<Agent | undefined>;
  conversation: ConversationState;
  script: ScriptState;
  dispatch: (action: any) => any;
} {
  const agentRef = useRef<Agent>();
  
  const [state, reducer] = useReducer((state, action) => {
    switch (action.type) {
      case "update_message":
        // use action.message and action.index to update the conversation state
        return {
          ...state,
          conversation: [...state.conversation.slice(0, action.index), action.message, ...state.conversation.slice(action.index+1)]
        };
      case "update_script":
        return {
          ...state,
          script: [...state.script.slice(0, action.index), action.message, ...state.script.slice(action.index+1)]
        };
      default:
        console.warn("unhandled action type:", action.type);
        return state;
    }
  }, {
    conversation: [
      {
        timestamp: Date.now(),
        role: "assistant",
        content: "Hi 👋, my name is FoFo. I am your writing partner!"
      }
    ],
    script: [{
      timestamp: Date.now(),
      role: "user",
      content: ""
    },
    {
      timestamp: Date.now(),
      role: "assistant",
      content: ""
    },
    {
      timestamp: Date.now(),
      role: "user",
      content: ""
    },
    {
      timestamp: Date.now(),
      role: "assistant",
      content: ""
    }]
  });

  useEffect(() => {
    if (!agentRef.current) {
      window.agent = agentRef.current = new Agent();
    }
    agentRef.current.updateDispatch(state, reducer);
  });

  return {
    agentRef: agentRef,
    conversation: state.conversation,
    script: state.script,
    dispatch: reducer
  };
}

function ScriptComponentEditor({
  index, 
  content,
  disabled,
  showInstructions,
  updateContent,
  handleEntryComplete,
  requestRegenerate
}) {
  const handleKeyPress = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && content.content.trim()) {
      console.log("user hit enter!")
      handleEntryComplete();
      e.preventDefault(); // Prevent default behavior of Enter key
      return false;
    }
  };

  return <div key={index} className="space-y-2">
    <div className="relative">
      <textarea
        value={content.content}
        onChange={(e) => updateContent(e.target.value)}
        onKeyDown={(e) => handleKeyPress(e)}
        placeholder={! disabled ? "TYPE IN YOUR SENTENCE..." : content.role === 'assistant' ? "(AI to fill in later)" : "(You to fill in later)"}
        className={`w-full p-4 rounded-lg border-2 resize-none overflow-hidden ${index % 2 === 0 ? 'border-blue-400' : 'border-orange-400'} bg-gray-100`}
        disabled={disabled}
        style={{
          minHeight: '60px',
          height: 'auto',
        }}
        onInput={(e) => {
          // Auto-adjust height
          if (e.target instanceof HTMLElement) {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }
        } } />
      {content.role === 'assistant' && (
        <button
          onClick={() => requestRegenerate()}
          className="absolute right-2 top-4 p-2 hover:bg-gray-200 rounded-full"
        >
          <RotateCcw className="w-5 h-5 text-gray-600" />
        </button>
      )}
    </div>

    {showInstructions && (
      <p className="text-sm text-gray-500 text-right">
        PRESS ENTER TO CONFIRM
      </p>
    )}
  </div>;
}

function FoFoChat({handleUserChat, conversation, script}) {
  const [userInput, setUserInput] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && userInput.trim()) {
      handleUserChat(userInput);
      setUserInput("");
      e.preventDefault(); // Prevent default behavior of Enter key
      return false;
    }
  };

  return (
    <div className="space-y-4">
      {conversation.map((message, index) => (
        <div key={index} className="space-y-2">
          <div className="text-sm text-gray-500">
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
          <div className={`p-4 rounded-lg ${message.role === 'assistant' ? 'bg-blue-100' : 'bg-orange-100'}`}>
            {message.content}
          </div>
        </div>
      ))}
      <div className="space-y-2">
        <textarea
          value={userInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder="Type your message here..."
          className="w-full p-4 rounded-lg border-2 resize-none overflow-hidden bg-gray-100"
          style={{
            minHeight: '60px',
            height: 'auto',
          }}
        />
      </div>
    </div>
  );
}

const ScriptCoWriter = () => {
  const {agentRef, conversation, script, dispatch} = useAgent();
  const [currentInput, setCurrentInput] = useState(0);

// Handle input change to update state dynamically
  const handleInputChange = (index: number, value: string) => {
    setInputs((prevInputs) => {
      const newInputs = [...prevInputs];
      newInputs[index] = value;
      return newInputs;
    });
  };

  const fofoHandleEvent = (type: string, data: any) => {
    switch (type) {
      case "user-message":
        agentRef?.current?.handleUserChat(data);
        break;
      case "user-completed-script-entry":
        agentRef?.current?.handleScriptUpdate(data)
        break;
      case "request-regenerate-script-entry":
        agentRef?.current?.regenerateScriptEntry(data)
        break;
      default:
        console.warn("unhandled event type:", type);
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

  const requestRegenerate = (index: number) => {
    fofoHandleEvent("request-regenerate-script-entry", {index});
  }
  
  const handleUserChat = (userMessage: string) => {
    fofoHandleEvent("user-message", userMessage);
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-8 min-h-[600px] bg-pink-50 rounded-lg flex gap-8">
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
          <FoFoChat handleUserChat={handleUserChat} conversation={conversation} script={script} />
          <div className="w-32 h-32 bg-orange-400 rounded-full relative">
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
          {script.map((entry, index) => (
            <ScriptComponentEditor 
              index={index} 
              disabled={index !== currentInput}
              showInstructions={index === currentInput}
              content={entry || ""} 
              updateContent={(content: string) => updateContent(index, content)}  
              handleEntryComplete={() => handleEntryComplete(index)} 
              requestRegenerate={() => requestRegenerate(index)} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScriptCoWriter;

