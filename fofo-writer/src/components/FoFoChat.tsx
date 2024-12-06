import React, { useState, useRef, useEffect } from 'react';
import { ConversationState, ScriptState } from '../types';

interface FoFoChatProps {
  handleUserChat: (userMessage: string) => void;
  conversation: ConversationState;
  script: ScriptState; // If needed, or remove if unused
  fofo_name: string;
  disabled: boolean;
}

const FoFoChat: React.FC<FoFoChatProps> = ({ handleUserChat, conversation, disabled, fofo_name }) => {
  const [userInput, setUserInput] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && userInput.trim()) {
      console.log("User pressed Enter key in the FoFoChat component! FoFoChat will call the handleUserChat function in App.tsx.");
      handleUserChat(userInput);
      setUserInput("");
      e.preventDefault(); // Prevent default behavior of Enter key
    }
  };

  useEffect(() => {
    //print out every message in conversation with its role to the console
    conversation.forEach((message) => {
      if (!message.content || message.content.trim() === "") {
        conversation.splice(conversation.indexOf(message), 1);
      }
      console.log(`${message.role}: ${message.content}`);
    });
    // Scroll to the bottom whenever the conversation changes
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversation]);

  return (
    <div className="space-y-4 max-h-full flex flex-col relative">
      {/* Chat Messages */}
      <div
      className="overflow-y-auto flex-1 space-y-4 pr-2"
      ref={chatContainerRef}
      >
      {conversation.map((message, index) => (
        
        <div key={`${message.timestamp}-${index}`} 
        // className={`flex justify-end items-start space-x-2`}
        >          
          <div className={`flex flex-col items-end text-left`}>
            
            <div className={`text-xs text-gray-500
              ${
                message.role === "assistant"
                ? "text-orange-700 self-start"
                : "text-blue-700 self-end ml-auto"
                }`}
              >
          
              {/* new Date(message.timestamp).toLocaleTimeString()*/}
              { message.role === "assistant"
                ? <span style={{paddingLeft: "75px"}}> {fofo_name} </span>
                : "You "}
                said:
            </div>
            <div>
            {
            // FoFo avatar! (display if message is from fofo)
            message.role === "assistant"
            ? <img
            src="../public/FOFO.png"
            alt="FoFo"
            // className="w-24 h-24 mr-2 -mb-4" 
            style={{width: "75px", height: "75px", display: "inline-block"}}
          /> : "" //don't display anything if the message is from the user
          } 

              <div
                style={{display: "inline-block", maxWidth: message.role === "assistant" ? "calc(100% - 75px)" : ""}}
                className={`p-3 rounded-md text-sm  ${
                message.role === "assistant"
                ? "bg-orange-200 text-orange-900 self-start"
                : "bg-blue-200 text-blue-900 self-end ml-auto"
                }`}>
                {message.content}
              </div>
            </div>
          </div>
        </div>
      ))}
      </div>

      {/* Input Box */}
      <div className="space-y-2 mt-4 relative flex justify-end">
      <textarea
        value={userInput}
        disabled={disabled}
        onChange={handleInputChange}
        onKeyDown={handleKeyPress}
        placeholder="Type your message here..."
        className="w-[100%] p-3 rounded-lg border border-gray-300 resize-none overflow-hidden bg-white shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
        style={{
        minHeight: "4em",
        }}
      />
      </div>
    </div>
  );
    
  
};

export default FoFoChat;
