import type { ActionProvider, VerifyResult } from '@tidygpt/shared';
import { executeAction } from '@tidygpt/ui-automation';
import type { PlatformId } from '@tidygpt/shared';
import { getPlatformAdapter, parseConversationId } from '@tidygpt/ui-automation';

export class DomActionProvider implements ActionProvider {
  constructor(private platform?: PlatformId) {}
  async archive(id: string) {
    const success = await executeAction(id, "archive", this.platform);
    return {
      id,
      action: "archive" as const,
      status: success ? "success" as const : "failed" as const,
      timestamp: new Date().toISOString()
    };
  }

  async delete(id: string) {
    const success = await executeAction(id, "delete", this.platform);
    return {
      id,
      action: "delete" as const,
      status: success ? "success" as const : "failed" as const,
      timestamp: new Date().toISOString()
    };
  }

  async verify(id: string, expected: "archived" | "deleted"): Promise<VerifyResult> {
    // Basic verification: does the link still exist in the DOM?
    const adapter = getPlatformAdapter(this.platform);
    const stillExists = Array.from(document.querySelectorAll(adapter.conversationLink)).some(link =>
      parseConversationId((link as HTMLAnchorElement).href, adapter) === id
    );
    return {
      status: stillExists ? "failed" : "success"
    };
  }
}
