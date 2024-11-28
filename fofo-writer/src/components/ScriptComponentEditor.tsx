import React, { useEffect, useRef } from 'react';
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

  const handleKeyPress = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation(); // Prevent the event from propagating further
    if (e.key === 'Enter' && content.content.trim()) {
      console.log('user hit enter!');
      handleEntryComplete();
      e.preventDefault(); // Prevent default behavior of Enter key
      return false;
    }
  };
  

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  return (
    <div key={index} className="space-y-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content.content}
          onChange={(e) => updateContent(e.target.value)}
          onKeyDown={(e) => handleKeyPress(e)}
          placeholder={
            !disabled
              ? 'TYPE IN YOUR SENTENCE...'
              : content.role === 'assistant'
              ? '(AI to fill in later)'
              : '(You to fill in later)'
          }
          className={`w-full p-4 rounded-lg border-2 resize-none overflow-hidden ${
            index % 2 === 0 ? 'border-blue-400' : 'border-orange-400'
          } bg-gray-100`}
          disabled={disabled}
          style={{
            minHeight: '60px',
            height: 'auto',
          }}
          onInput={(e) => {
            // Auto-adjust height
            if (e.target instanceof HTMLElement) {
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }
          }}
        />
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
        <p className="text-sm text-gray-500 text-right">PRESS ENTER TO CONFIRM</p>
      )}
    </div>
  );
};

export default ScriptComponentEditor;
