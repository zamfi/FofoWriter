import React, { useState } from 'react';
import { ConversationState, ScriptState } from '../types';

interface FoFoChatProps {
  handleUserChat: (userMessage: string) => void;
  conversation: ConversationState;
  script: ScriptState; // If needed, or remove if unused
  disabled: boolean;
}

const FoFoChat: React.FC<FoFoChatProps> = ({ handleUserChat, conversation, disabled }) => {
  const [userInput, setUserInput] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && userInput.trim()) {
      console.log("User pressed Enter key in the FoFoChat component! FofoChat will call the handleUserChat fucntion in app.tsx..");
      handleUserChat(userInput);
      setUserInput("");
      e.preventDefault(); // Prevent default behavior of Enter key
    }
  };

  return (
    <div className="space-y-4 max-h-full flex flex-col">
      {/* Chat Messages */}
      <div className="overflow-y-auto flex-1 space-y-4 pr-2">
        {conversation.map((message, index) => (
          <div key={`${message.timestamp}-${index}`} className="space-y-1">
            <div className="text-xs text-gray-500">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
            <div
              className={`p-3 rounded-md text-sm ${
                message.role === "assistant" ? "bg-blue-200 text-blue-900" : "bg-orange-200 text-orange-900"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
      </div>

      {/* Input Box */}
      <div className="space-y-2 mt-4">
        <textarea
          value={userInput}
          disabled={disabled}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder="Type your message here..."
          className="w-full p-3 rounded-lg border border-gray-300 resize-none overflow-hidden bg-white shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
          style={{
            minHeight: "60px",
          }}
        />
      </div>
    </div>
  );
};

export default FoFoChat;
