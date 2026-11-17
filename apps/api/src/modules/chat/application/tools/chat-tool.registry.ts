import { Injectable } from '@nestjs/common';
import { ToolDef } from '../../../../shared/llm';
import { SearchNormasTool } from './search-norms.tool';
import { SecopContractsTool } from './secop-contracts.tool';
import { AgentContext, ChatTool, ToolResult } from './types';

@Injectable()
export class ChatToolRegistry {
  private readonly tools: ChatTool[];
  private readonly byName: Map<string, ChatTool>;

  constructor(searchNormas: SearchNormasTool, secopContracts: SecopContractsTool) {
    this.tools = [searchNormas, secopContracts];
    this.byName = new Map(this.tools.map((t) => [t.definition.function.name, t]));
  }

  get definitions(): ToolDef[] {
    return this.tools.map((t) => t.definition);
  }

  async execute(
    name: string,
    argsJson: string,
    ctx: AgentContext | null,
  ): Promise<ToolResult> {
    const tool = this.byName.get(name);
    if (!tool) return this.unknown(name);
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(argsJson || '{}') as Record<string, unknown>;
    } catch {
      return { text: 'argumentos inválidos', hits: [] };
    }
    return tool.execute(args, ctx);
  }

  private unknown(name: string): ToolResult {
    return {
      text:
        `herramienta desconocida: ${name}. Disponibles: ${[...this.byName.keys()].join(', ')}. ` +
        `Si ya tienes evidencia suficiente, responde con texto y citas.`,
      hits: [],
    };
  }
}
