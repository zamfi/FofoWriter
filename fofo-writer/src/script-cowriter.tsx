import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';

const ScriptCoWriter = () => {
  const [inputs, setInputs] = useState(['', '', '', '']);
  const [currentInput, setCurrentInput] = useState(0);

  const generateAIResponse = (previousInput: string) => {
    const lowercase = previousInput.toLowerCase();
    
    if (lowercase.includes('bake sale')) {
      return [
        "We've got cookies, cakes, and pies galore - all homemade with love! 🍪",
        "Every treat you buy helps support our students' educational journey! 📚",
        "Stop by and satisfy your sweet tooth while supporting a great cause!"
      ];
    }
    if (lowercase.includes('saturday') || lowercase.includes('weekend')) {
      return [
        "Mark your calendars! We'll be serving fresh treats from 9AM to 3PM! ⏰",
        "Bring the whole family for a day of delicious fun and community spirit!",
        "Don't miss out on this sweet opportunity to make a difference!"
      ];
    }
    if (lowercase.includes('fundraiser') || lowercase.includes('support')) {
      return [
        "Your support means new books, supplies, and opportunities for our students! 📚",
        "Together, we can create a brighter future for our school community!",
        "Every dollar raised goes directly to enriching our students' education!"
      ];
    }
    if (lowercase.includes('community') || lowercase.includes('school')) {
      return [
        "Our amazing parent volunteers have been baking up a storm! 👩‍🍳",
        "Come show your community spirit and support our wonderful school!",
        "Together, we make our school community stronger, one treat at a time!"
      ];
    }
    
    return [
      "We've got something sweet cooking up for everyone! 🧁",
      "Your support makes a real difference in our students' lives! ❤️",
      "Don't forget to share this event with your friends and family!"
    ];
  };

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    if (e.key === 'Enter' && inputs[index].trim()) {
      if (index % 2 === 0 && index < inputs.length - 1) {
        const suggestions = generateAIResponse(inputs[index]);
        const newInputs = [...inputs];
        newInputs[index + 1] = suggestions[0];
        setInputs(newInputs);
      }
      setCurrentInput(index + 1);
    }
  };

  const handleRegenerate = (index: number) => {
    const previousUserInput = inputs[index - 1];
    const suggestions = generateAIResponse(previousUserInput);
    const currentSuggestion = inputs[index];
    const currentIndex = suggestions.indexOf(currentSuggestion);
    const nextIndex = (currentIndex + 1) % suggestions.length;
    
    const newInputs = [...inputs];
    newInputs[index] = suggestions[nextIndex];
    setInputs(newInputs);
  };

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
          <div className="bg-white rounded-2xl p-4 mb-4 inline-block relative">
            <p className="text-lg">
              Hi 👋, my name is FoFo. I am your writing partner!
            </p>
          </div>
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
          {inputs.map((input, index) => (
            <div key={index} className="space-y-2">
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  placeholder="TYPE IN YOUR SENTENCE..."
                  className={`w-full p-4 rounded-lg border-2 resize-none overflow-hidden ${
                    index % 2 === 0 ? 'border-blue-400' : 'border-orange-400'
                  } bg-gray-100`}
                  disabled={index !== currentInput}
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
                  }}
                />
                {index % 2 === 1 && (
                  <button
                    onClick={() => handleRegenerate(index)}
                    className="absolute right-2 top-4 p-2 hover:bg-gray-200 rounded-full"
                  >
                    <RotateCcw className="w-5 h-5 text-gray-600" />
                  </button>
                )}
              </div>
              
              {index === currentInput && (
                <p className="text-sm text-gray-500 text-right">
                  PRESS ENTER TO CONFIRM
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScriptCoWriter;