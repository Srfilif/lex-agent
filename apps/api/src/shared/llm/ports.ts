// Puerto compartido de acceso a modelos. La aplicación depende de esta
// interfaz; el adaptador HTTP vive en `shared/llm/model-gateway.ts`.
export const LLM_CHAT = Symbol('LLM_CHAT');

export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: string;
}

export interface ChatResult {
  content: string;
  toolCalls: ToolCall[];
  usage: { prompt: number; completion: number; total: number };
  /** B7: modelo que respondió de verdad (puede ser un fallback). */
  model: string;
}

export interface ChatOptions {
  tools?: ToolDef[];
  maxTokens?: number;
  model?: string;
  fallbacks?: string[];
}

export interface LlmChatPort {
  chat(messages: ChatMsg[], opts?: ChatOptions): Promise<ChatResult>;
}
