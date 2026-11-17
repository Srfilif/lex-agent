import { ToolDef } from '../../../../shared/llm';

export interface AgentContext {
  userId: string;
  projectId: string | null;
}

export interface ToolHit {
  text: string;
  chunk_id: string | null;
  secop_ref: string | null;
  ruta: string;
  titulo: string;
}

export interface ToolResult {
  text: string;
  hits: ToolHit[];
}

/** Estrategia de una herramienta expuesta al modelo. */
export interface ChatTool {
  readonly definition: ToolDef;
  execute(args: Record<string, unknown>, ctx: AgentContext | null): Promise<ToolResult>;
}
