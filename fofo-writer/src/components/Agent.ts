import { ConversationState, ScriptState, Message } from '../types'; // Adjust import based on your types location
import OpenAI from 'openai';
import { Stream } from 'openai/streaming.mjs';
import { ChatCompletion, ChatCompletionChunk } from 'openai/resources/chat/index.mjs';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import * as PJSON from 'partial-json';
import { log } from '../utils/logging';

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
  // @ts-ignore
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
export default class Agent { //sycophantic is either true/false (which makes them robotic/neutral), task_condition is either 'bake_sale' or 'potluck'
  state: { 
    conversation: ConversationState; 
    script: ScriptState; 
    sycophantic: boolean; 
    task_condition: string;
    challenge_over: boolean;
  };
  dispatch: (action: any) => any;
  user_id: string;


  constructor(sycophantic: boolean, task_condition: string, user_id: string) {
    this.state = { 
      conversation: [], 
      script: [], 
      sycophantic: sycophantic, 
      task_condition: task_condition, 
      challenge_over: false 
    };
    this.user_id = user_id;
    console.log(`This agent is ${sycophantic ? 'sycophantic' : 'neutral'} and helping with a ${this.state.task_condition == 'bake sale' ? 'bake sale' : 'potluck'}. Challenge is ${this.state.challenge_over ? 'done' : 'not done'}. `);
    this.dispatch = () => {};

  }

  updateDispatch(state: { conversation: ConversationState; script: ScriptState; sycophantic: boolean; task_condition: string; challenge_over: boolean}, dispatch: (action: any) => any): void {
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
  
  handleResponses(responses: any[], chatIndex = this.state.conversation.length) {
    responses.forEach((response) => {
      if (! ('message' in response)) return; // didn't get to a message of this partial response yet!
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
      } else if (response.type === 'script') {
        console.log("dispatching an updated script message: ", response );
        this.dispatch({
          type: 'update_script',
          index: response.index, // Use the index provided in the response
          message: {
            timestamp: Date.now(),
            role: 'assistant',
            content: response.message,
          },
        });
      } else {
        console.log("unhandled response type: ", response);
      }
    });
  }


  handleInterimResponses(chatIndex:number, chunk: ChoiceChunk) {
    //console.log("handleInterimResponses called with chunk", chunk);
    try {
      const responsesSoFar = PJSON.parse(chunk?.aggregated?.message?.content?.trim?.() || '{"responses": []}')?.responses;
      if (! responsesSoFar) {
        return;
      }

      this.handleResponses(responsesSoFar, chatIndex);    
    } catch (error) {
      console.error('Error handling interim responses:', error, chunk);
      throw error;
    }
  }

  static systemMessages = {
    "chat_sycophantic": { //reminds the agent to be sycophantic
      timestamp: Date.now(), 
      role: 'system', 
      content: 
        `
        Your specified personality is SYCOPHANTIC.
        You are a SUPER friendly, SYCOPHANTIC co-writing chatbot assistant. 
        Maintain an overly positive, enthusiastic, and praising tone, while still being concise.  
        Be overly kind and reverent, and as CONCISE as possible! no more than 200 characters per message.`
    } as Message,
    "chat_robotic": {  //reminds the agent to be robotic
      timestamp: Date.now(), 
      role: 'system', 
      content: 
        `Your specified personality is NEUTRAL.
        You're a neutral, robotic co-writing chatbot assistant. 
        You should NOT try to sound humanistic or friendly; quite the opposite, actually. 
        Please be as concise, neutral, unopinionated, and robotic as possible.`
    } as Message,
    "chat_all": { // gives the agent (regardless of affect) context on the task.
      timestamp: Date.now(), 
      role: 'system', 
      content: 
        `
        You are having a conversation with a user to help them write a script for a social media video advertising a fundraiser event.
        The user and you will be alternating sentences in the script, with the user going first. 
        You can also provide feedback on the user's sentences and suggest improvements, and the user may make requests of you as well. 
        UNLESS EXPLICITLY REQUESTED, DO NOT ADD OR UPDATE ANY SCRIPT ITEMS. (so don't sent a 'script' type message)
        `
    } as Message,

    "bake_sale":{// bake sale condition
      timestamp: Date.now(), 
      role: 'system', 
      content: 
        `
        The event that the social media video will advertise is a bake sale fundraiser event for a local community school.
        `
    } as Message,
    "potluck":{
      timestamp: Date.now(), 
      role: 'system', 
      content: 
        `
        The event that the social media video will advertise is a community potluck.
        `
    } as Message,

    "scriptUpdated": { 
      timestamp: Date.now(), 
      role: 'system', 
      content: 
        `THE USER HAS JUST UPDATED A SCRIPT ITEM. IT MAY BE YOUR TURN TO ADD A NEW ITEM, BUT ONLY IF THERE IS A BLANK ITEM AFTER THE USER'S LAST ENTRY.
        `
    } as Message,

  }



  /************************************************/
  /* ------- code for handling user chat  ------- */
  /************************************************/
  async handleUserChat(userContent: string): Promise<void> {
    console.log("handling user chat... **Agent.tsx**");
    // first track where the assistant chats should go
    const nextChatsAtIndex = this.state.conversation.length + 1;

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
        "Here's the current script:",
        JSON.stringify({script: this.state.script.map((o, i) => ({...o, index: i}))}, null, 2),
        "DO NOT TOUCH THE SCRIPT. ONLY send a 'chat' type message, NOT a 'script' message"
      ].join("\n\n")
    }

    // Add user message to conversation state -- needs to be a message object in the above format
    this.dispatch({
      type: 'update_message',
      index: this.state.conversation.length,
      message: userMessage
    });
    log({
      type: "new-chat-message",
      data: {
        message: userMessage,
      }
    });

    // let's cache the set of messages (system messages relevant to chat + conversation + user message + script message) 
    
    const llmMessages = [
      this.state.sycophantic ? Agent.systemMessages.chat_sycophantic : Agent.systemMessages.chat_robotic,
      this.state.task_condition === 'bake sale' ? Agent.systemMessages.bake_sale : Agent.systemMessages.potluck,
      Agent.systemMessages.chat_all,
      ...this.state.conversation,
      userMessage,
      scriptMessage
    ];

    try {
      // Call OpenAI API
      console.log("LLM being called with these messages:", llmMessages);
      const response = await this.callLLM(
        llmMessages, 
        this.state.script.some(o => o.content.trim().length > 0) ? ResponsesList : ChatOnlyResponsesList,
        (chunk) => {
          //this will update the chat responses in the conversation!
          this.handleInterimResponses(nextChatsAtIndex, chunk);
        });
      log({
        type: "chat-response",
        data: {
          response: response,
        }
      });
    } catch (error) {
      console.error('Error handling user chat:', error);
    }
  }//END OF USER CHAT FUNCTION



  /****************************************************/
  /* ------- code for handling SCRIPT update  ------- */
  /****************************************************/
  async handleScriptUpdate({ index, content, requested_index = index + 1 }: { index: number; content: string; requested_index?: number }) {
    // Determine if we should challenge this turn
    const challenge_this_turn = (requested_index % 3 === 0 && !this.state.challenge_over); // Challenge every 3rd turn
    console.log(`will we challenge this turn? ${challenge_this_turn}. ${this.state.challenge_over} is the challenge_over state`)
      
    // Reset the challenge_over state every 4th turn
    if (requested_index % 4 === 0) {
      this.state.challenge_over = false;
    }

   const chatMessage: Message = {
      timestamp: Date.now(),
      role: 'system',
      content: [
         "Here's the state of the conversation you've been having, btw:",
         JSON.stringify({ conversation: this.state.conversation.map((o, i) => ({ ...o, index: i })) }, null, 2),
      ].join("\n\n"),
    };
    let scriptMessage: Message;

    if (challenge_this_turn) {
      this.state.challenge_over = true;
      console.log(`challenging this turn! ${this.state.challenge_over} is the challenge_over state`)
      
      scriptMessage = {  //tells the agent to challenge something the user wrote.
        timestamp: Date.now(), 
        role: 'system', 
        content: [
          `here's the current state of the script:`,
          JSON.stringify({ script: this.state.script.map((o, i) => ({ ...o, index: i })) }, null, 2),
          `THE USER HAS JUST UPDATED A SCRIPT ITEM. 
          We want to test if the user is willing to accept your feedback to change an important part of their script. 
          Select one of the user's script items and suggest an alternative AS A 'chat' TYPE MESSAGE. You should make your selection carefully:
          The suggested change should be a substantial challenge to the user that would force them to carefully consider whether to take your advice; something that significantly impacts the script
          It should NOT be a minor change (like a single word or insubstantial detail)
          You should not be offensive. Make sure your messages are VERY BRIEF, only 200 characters or less, and aligned with your specified personality..`
        ].join("\n\n"),
      };
         } else {  
          console.log(`not challenging this turn! ${requested_index} is the requested index`) 
          scriptMessage = {
            timestamp: Date.now(),
            role: 'system',
            content: [
              "And here's the current state of the script:",
              JSON.stringify({ script: this.state.script.map((o, i) => ({ ...o, index: i })) }, null, 2),
              `The user just changed the item at index ${index} to read "${content}". You have been asked to write a script item at index ${requested_index}. 
              You should ALSO send a separate 'chat' type message with commentary for the user on why you wrote what you did, what you're thinking of the script so far, etc. Do NOT send your chat as a 'script' type message, or it will show up in the wrong place in the interface. 
              Make sure your messages are BRIEF, only 200 characters or less, and aligned with your specified personality. `,
            ].join("\n\n"),
          };
     

    }

    

    // Cache messages to send to the API
    const llmMessages = [
      this.state.sycophantic ? Agent.systemMessages.chat_sycophantic : Agent.systemMessages.chat_robotic, //remind of personality

      this.state.task_condition === 'bake sale' ? Agent.systemMessages.bake_sale : Agent.systemMessages.potluck, //remind of task

      Agent.systemMessages.scriptUpdated,  
      chatMessage, //include current chat conversation
      scriptMessage];// send the script and appropriate script message 
  
    console.log("LLM being called to add to the script, with these messages:", llmMessages);
    const chatIndex = this.state.conversation.length; // any new chat messages will be added after the current conversation
  
    try {
      const choice = await this.callLLM(
        llmMessages,
        this.state.script.some((o) => o.content.trim().length > 0) ? ResponsesList : ChatOnlyResponsesList,
        (chunk) => {
          this.handleInterimResponses(chatIndex, chunk);
        }
      );
  
      // Parse responses
      const responses = JSON.parse(choice?.message?.content || '{}').responses;
      console.log("final responses:", responses);
      log({
        type: "user-script-update-response",
        data: {
          responses: responses,
        }
      })
      // Pass responses to the handler
      this.handleResponses(responses, chatIndex);
    } catch (error) {
      console.error('Error handling script update:', error);
    }
  }


  /****************************************************/
  /* ------- code for handling SCRIPT update  ------- */
  /****************************************************/
  
  async regenerateScriptEntry({ index }: { index: number }) {
    console.log("regeneration requested...")
    // Check if the index is valid
    if (index < 0 || index >= this.state.script.length) {
      console.error('Invalid script index:', index);
      return;
    }

    const scriptMessage: Message = {
      timestamp: Date.now(),
      role: 'system',
      content: `The user didn't like your previous attempt; regenerate the script entry at index ${index}. 
        Here's the current state of the script: 
        ${JSON.stringify(this.state.script.map((entry, i) => ({ index: i, ...entry })), null, 2)}
        Provide only the regenerated entry as a "script" type response. Make sure it's only around 200 characters or less.`,
    };

    const chatIndex = this.state.conversation.length+1; // any new chat messages will be added after the current conversation

    try {
      // Call LLM
      const choice = await this.callLLM(
        [...this.state.conversation, scriptMessage],
        ResponsesList,
        (chunk) => {
          this.handleInterimResponses(chatIndex, chunk);
        }
      );
  
      // Parse responses
      const responses = JSON.parse(choice?.message?.content || '{}').responses;
      console.log("final responses:", responses);
      log({
        type: "regenerate-script-entry-response",
        data: {
          responses: responses,
        }
      })
  
      // Pass responses to the handler
      this.handleResponses(responses, chatIndex);
    } catch (error) {
      console.error('Error regenerating script entry:', error);
    }
  }

  
}
