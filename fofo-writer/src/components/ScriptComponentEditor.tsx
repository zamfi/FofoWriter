import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { ScriptEntry } from '../types'; // Import ScriptEntry type if defined in a separate types file

interface ScriptComponentEditorProps {
  index: number;
  content: ScriptEntry;
  disabled: boolean;
  showInstructions: boolean;
  updateContent: (content: string) => void;
  handleEntryComplete: () => void;
  requestRegenerate: () => void;
}

const ScriptComponentEditor: React.FC<ScriptComponentEditorProps> = ({
  index,
  content,
  disabled,
  showInstructions,
  updateContent,
  handleEntryComplete,
  requestRegenerate,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isLoading, setIsLoading] = useState(false); // Track loading state

  const handleKeyPress = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && content.content.trim()) {
      console.log('user hit enter!');
      handleEntryComplete();
      e.preventDefault(); // Prevent default behavior of Enter key
      return false;
    }
  };

  const handleRegenerateClick = async () => {
    setIsLoading(true); // Show loading state
    updateContent('...'); // Temporarily set content to loading message
    try {
      await requestRegenerate(); // Call requestRegenerate
    } finally {
      setIsLoading(false); // Reset loading state
    }
  };

  // useEffect(() => {
  //   if (!disabled && textareaRef.current) {
  //     textareaRef.current.focus();
  //   }
  // }, [disabled]);

    return (
    <div key={index} className="space-y-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={isLoading ? '...loading...' : content.content} // Show loading text if loading
          onChange={(e) => updateContent(e.target.value)}
          onKeyDown={(e) => handleKeyPress(e)}
          placeholder={
            !disabled
              ? 'TYPE IN YOUR SENTENCE...'
              : content.role === 'assistant'
              ? '(AI to fill in later)'
              : '(You to fill in later)'
          }
          className={`font-serif w-full p-4 rounded-lg border-2 resize-none overflow-wrap ${
            index % 2 === 0 ? 'border-blue-400 ' : 'border-orange-400 pr-10'} 
            ${isLoading ? 'border-gray-600 bg-gray-300 ' : ''} 
          bg-gray-100`}
          disabled={disabled || isLoading} // Disable while loading
          style={{
            minHeight: '60px',
            height: 'auto',
          }}
          onInput={(e) => {
            if (e.target instanceof HTMLElement) {
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }
          }}
        />
        {content.role === 'assistant' && (
          <button
            onClick={handleRegenerateClick} // Use the new handler
            className="absolute right-2 top-4 p-2 hover:bg-gray-200 rounded-full"
            disabled={isLoading} // Disable button while loading
          >
            <RotateCcw className="w-5 h-5 text-gray-600" />
          </button>
        )}
      </div>
      {showInstructions && (
        <p className="text-sm text-gray-500 text-right">PRESS ENTER TO CONFIRM</p>
      )}
    </div>
  );

};

export default ScriptComponentEditor;
