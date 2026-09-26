import { RunbookVisualizer } from "@/components/runbook";
import type { AgentExecutionState } from "@/types/domain";

export interface RunbookSectionProps {
  readonly execution?: AgentExecutionState | null;
  readonly isConnected?: boolean;
}

export function RunbookSection({ execution, isConnected }: RunbookSectionProps = {}) {
  return <RunbookVisualizer execution={execution} isConnected={isConnected} />;
}

