import type { ActionProvider, VerifyResult } from '@tidygpt/shared';
import { executeAction } from '@tidygpt/ui-automation';

export class DomActionProvider implements ActionProvider {
  async archive(id: string) {
    const success = await executeAction(id, "archive");
    return {
      id,
      action: "archive" as const,
      status: success ? "success" as const : "failed" as const,
      timestamp: new Date().toISOString()
    };
  }

  async delete(id: string) {
    const success = await executeAction(id, "delete");
    return {
      id,
      action: "delete" as const,
      status: success ? "success" as const : "failed" as const,
      timestamp: new Date().toISOString()
    };
  }

  async verify(id: string, expected: "archived" | "deleted"): Promise<VerifyResult> {
    // Basic verification: does the link still exist in the DOM?
    const stillExists = !!document.querySelector(`a[href*="/c/${id}"]`);
    return {
      status: stillExists ? "failed" : "success"
    };
  }
}
