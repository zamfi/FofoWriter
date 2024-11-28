export type Message = {
    timestamp: number;
    role: "assistant" | "user" | "system";
    content: string;
  };
  
  export type ConversationState = Message[];
  
  export type ScriptEntry = {
    timestamp: number;
    role: "assistant" | "user";
    content: string;
  };
  
  export type ScriptState = ScriptEntry[];
  