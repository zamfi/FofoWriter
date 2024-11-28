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

// Agent Class
export default class Agent {
  state: { conversation: ConversationState; script: ScriptState };
  dispatch: (action: any) => any;

  constructor() {
    this.state = { conversation: [], script: [] };
    this.dispatch = (action) => {};
  }

  updateDispatch(state, dispatch) {
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
  handleResponses(chatIndex = this.state.conversation.length, responses: any[]) {
    for (const response of responses) {
      if (response.type === 'chat') {
        this.dispatch({
          type: 'update_message',
          index: chatIndex++, // Increment the chat index for each new message
          message: {
            timestamp: Date.now(),
            role: response.role,
            content: response.message,
          },
        });
      } else if (response.type === 'script') {
        if ('message' in response) {
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
      }
    }
  }

  // Handle interim responses
  handleInterimResponses(chatIndex: number, chunk: { chunk: ChatCompletionChunk.Choice; aggregated: ChatCompletion.Choice }) {
    const responsesSoFar = PJSON.parse(chunk?.aggregated?.message?.content || '{}')?.responses;
    if (responsesSoFar) {
      this.handleResponses(chatIndex, responsesSoFar);
    }
  }

  // Handle user chat
  async handleUserChat(userContent: string) {
    const nextChatsAtIndex = this.state.conversation.length + 1;
    const userMessage = { timestamp: Date.now(), role: 'user', content: userContent } as Message;
    this.dispatch({ type: 'update_message', index: this.state.conversation.length, message: userMessage });
    const choice = await this.callLLM(
      [userMessage, ...this.state.conversation],
      ChatOnlyResponsesList,
      (chunk) => this.handleInterimResponses(nextChatsAtIndex, chunk)
    );
    const responses = JSON.parse(choice?.message?.content || '{}').responses;
    this.handleResponses(nextChatsAtIndex, responses);
  }

  // Handle script update
  async handleScriptUpdate({ index, content }: { index: number; content: string }) {
    // Define scriptMessage as a Message type
    const scriptMessage: Message = {
      timestamp: Date.now(),
      role: "system", // Explicitly use a valid value from the union type
      content: `Script updated at index ${index} to "${content}".`,
    };

    // Call the LLM with the updated message and conversation history
    const choice = await this.callLLM(
      [scriptMessage, ...this.state.conversation], // Include the new system message in the context
      ResponsesList // Use the appropriate response schema
    );

    // Parse the LLM response content
    const responses = JSON.parse(choice?.message?.content || '{}').responses;

    // Handle the responses from the LLM
    this.handleResponses(this.state.conversation.length, responses);
  }

  // Regenerate script entry
  async regenerateScriptEntry({ index }: { index: number }) {
    const scriptMessage = {
      timestamp: Date.now(),
      role: 'system',
      content: `Regenerating script entry at index ${index}.`,
    };
    const choice = await this.callLLM(
      [scriptMessage, ...this.state.conversation],
      ResponsesList
    );
    const responses = JSON.parse(choice?.message?.content || '{}').responses;
    for (const response of responses) {
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
    }
  }
}
