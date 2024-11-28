import { ConversationState, ScriptState, Message } from '../types'; // Adjust import based on your types location
import OpenAI from 'openai';
import { Stream } from 'openai/streaming.mjs';
import { ChatCompletion, ChatCompletionChunk } from 'openai/resources/chat/index.mjs';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import * as PJSON from 'partial-json';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,dangerouslyAllowBrowser: true 
});

// Define schemas for OpenAI responses
const MessageResponse = z.object({
  type: z.literal('chat'),
  role: z.literal('assistant'),
  message: z.string(),
});

const ScriptResponse = z.object({
  type: z.literal('script'),
  index: z.number(),
  message: z.string(),
});

const ResponsesList = z.object({
  responses: z.array(z.union([MessageResponse, ScriptResponse])),
});

const ChatOnlyResponsesList = z.object({
  responses: z.array(MessageResponse),
});

type ChoiceChunk = {
  chunk: ChatCompletionChunk.Choice;
  aggregated: ChatCompletion.Choice;
}

// Utility function for aggregating chunks
function aggregateChunks(
  base: ChatCompletion.Choice,
  chunks: ChatCompletionChunk.Choice[]
): ChatCompletion.Choice {
  return chunks.reduce<ChatCompletion.Choice>((acc, chunk) => {
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
                name: (acc[toolCall.index]?.function?.name || '') + (toolCall.function?.name || ''),
              },
            };
            return acc;
          }, acc?.message?.tool_calls || [])
        } : {}),
      },
    };
  }, base);
}


/************************************************/
/*                  AGENT CLASS                 */
/************************************************/
export default class Agent {
  state: { conversation: ConversationState; script: ScriptState };
  dispatch: (action: any) => any;

  constructor() {
    this.state = { conversation: [], script: [] };
    this.dispatch = (action) => {};
  }

  updateDispatch(state: { conversation: ConversationState; script: ScriptState }, dispatch: (action: any) => any): void {
    this.state = state;
    this.dispatch = dispatch;
  }

  // Call OpenAI API
  async callLLM(
    messages: Message[],
    responseSchema: any,
    chunk_cb?: (chunk: { chunk: ChatCompletionChunk.Choice; aggregated: ChatCompletion.Choice }) => void
  ): Promise<ChatCompletion.Choice | null> {
    const stream = chunk_cb !== undefined;

    // Validate messages
    messages.forEach((msg, index) => {
      if (!msg.content || typeof msg.content !== 'string') {
        console.error(`Invalid message at index ${index}:`, msg);
      }
    });

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        stream,
        ...(responseSchema ? { response_format: zodResponseFormat(responseSchema, 'response') } : {}),
      });

      if (stream) {
        let aggregatedCompletion = {} as ChatCompletion.Choice;
        for await (const chunk of completion as Stream<ChatCompletionChunk>) {
          aggregatedCompletion = aggregateChunks(aggregatedCompletion, [chunk?.choices?.[0]]);
          chunk_cb?.({
            chunk: chunk?.choices?.[0],
            aggregated: aggregatedCompletion,
          });
        }
        return aggregatedCompletion;
      } else {
        return (completion as ChatCompletion)?.choices[0];
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
      return null;
    }
  }

  // Handle responses
  
  handleChatResponses(chatIndex = this.state.conversation.length, responses: any[]) {
    responses.forEach((response) => {
      if (response.type === 'chat') {
        // Check if the message already exists in the state
        const existingMessage = this.state.conversation.find(
          (msg) => msg.content === response.message && msg.role === response.role
        );
        if (!existingMessage) {
          console.log("dispatching an updated message..." );
          this.dispatch({
            type: 'update_message',
            index: chatIndex++, // Increment the chat index for each new message
            message: {
              timestamp: Date.now(),
              role: response.role,
              content: response.message,
            },
          });
        }
      }
    });
  }

  handleScriptResponses(responses: any[]) {
    console.log("handleScriptResponses called with responses:", responses);
    responses.forEach((response) => {
      if (response.type === 'script') {
        this.dispatch({
          type: 'update_script',
          index: response.index, // Use the index provided in the response
          message: {
            timestamp: Date.now(),
            role: 'assistant',
            content: response.message,
          },
        });
      }
    });
  }


  handleInterimResponses(chatIndex:number, chunk: ChoiceChunk) {
    //console.log("handleInterimResponses called with chunk", chunk);
    const responsesSoFar = PJSON.parse(chunk?.aggregated?.message?.content || '{}')?.responses;
    if (! responsesSoFar) {
      return;
    }

    this.handleChatResponses(chatIndex, responsesSoFar);    
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



  /************************************************/
  /* ------- code for handling user chat  ------- */
  /************************************************/
  async handleUserChat(userContent: string): Promise<void> {
    // first track where the assistant chats should go
    const nextChatsAtIndex = this.state.conversation.length + 1;

    console.log("user has sent a chat to the Agent!");
    if (!userContent || userContent.trim() === '') {
      console.error('User content is invalid or empty.');
      return;
    }

     // let's construct the user message object first
    const userMessage: Message = {
      timestamp: Date.now(),
      role: 'user',
      content: userContent.trim(),
    };

     // let's include the current state of the script too
     const scriptMessage: Message = {
      timestamp: Date.now(),
      role: 'system',
      content: [
        "Here's the current script, btw:",
        JSON.stringify({script: this.state.script.map((o, i) => ({...o, index: i}))}, null, 2),
        "IF IT IS ALL BLANK DO NOT TOUCH THE SCRIPT."
      ].join("\n\n")
    }


    // Add user message to conversation state
    this.dispatch({
      type: 'update_message',
      index: this.state.conversation.length,
      message: userMessage,
    });

    // let's cache the set of messages (system messages relevant to chat + conversation + user message + script message) 
    const llmMessages = [Agent.systemMessages.chat, ...this.state.conversation, userMessage, scriptMessage];


    // we need to generate a response
    console.log("LLM being called with messages", llmMessages);

    try {
      // Call OpenAI API
      console.log("calling openAI api...")
      const choice = await this.callLLM(
        llmMessages, 
        this.state.script.some(o => o.content.trim().length > 0) ? ResponsesList : ChatOnlyResponsesList,
        (chunk) => {
          //this will update the chat responses in the conversation!
          this.handleInterimResponses(nextChatsAtIndex, chunk);
        });
      
    } catch (error) {
      console.error('Error handling user chat:', error);
    }
  }//END OF USER CHAT FUNCTION



  /****************************************************/
  /* ------- code for handling SCRIPT update  ------- */
  /****************************************************/
  async handleScriptUpdate({ index, content }: { index: number; content: string }) {
    const scriptMessage: Message = {
      timestamp: Date.now(),
      role: 'system',
      content: [
        "Here's the current script, btw:",
        JSON.stringify({ script: this.state.script.map((o, i) => ({ ...o, index: i })) }, null, 2),
        `The user just changed the item at index ${index} to read "${content}".`,
      ].join("\n\n"),
    };
  
    // Cache messages to send to the API
    const llmMessages = [Agent.systemMessages.scriptUpdated, ...this.state.conversation, scriptMessage];
  
    console.log("LLM being called with messages", llmMessages);
  
    try {
      const choice = await this.callLLM(
        llmMessages,
        this.state.script.some((o) => o.content.trim().length > 0) ? ResponsesList : ChatOnlyResponsesList,
        (chunk) => {
          this.handleInterimResponses(this.state.script.length, chunk);
        }
      );
  
      // Parse responses
      const responses = JSON.parse(choice?.message?.content || '{}').responses;
      console.log("final responses:", responses);
  
      // Pass responses to the handler
      this.handleScriptResponses(responses);
    } catch (error) {
      console.error('Error handling script update:', error);
    }
  }
  
  //regenerate script entry
  async regenerateScriptEntry({ index }: { index: number }) {
    console.log("regeneration not implemented fully yet oops");
    return
    const scriptMessage: Message = {
      timestamp: Date.now(),
      role: 'system',
      content: `Regenerating script entry at index ${index}.`,
    };
  
    try {
      const choice = await this.callLLM(
        [...this.state.conversation, scriptMessage],
        ResponsesList
      );
  
      const responses = JSON.parse(choice?.message?.content || '{}').responses;
  
      // Handle responses specifically for regeneration
      responses.forEach((response: { type: string; index: number; message: any; }) => {
        if (response.type === 'script' && response.index === index) {
          this.dispatch({
            type: 'update_script',
            index: response.index,
            message: {
              timestamp: Date.now(),
              role: 'assistant',
              content: response.message,
            },
          });
        }
      });
    } catch (error) {
      console.error('Error regenerating script entry:', error);
    }
  }
  
}
