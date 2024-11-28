import React, { useState } from 'react';
import { ConversationState, ScriptState } from '../types'; 

interface FoFoChatProps {
  handleUserChat: (userMessage: string) => void;
  conversation: ConversationState;
  script: ScriptState;
  disabled: boolean;
}

const FoFoChat: React.FC<FoFoChatProps> = ({ handleUserChat, conversation, disabled }) => {
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
          disabled={disabled}
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
};

export default FoFoChat;
