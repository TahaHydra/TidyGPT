// src/export-provider.ts
var ExportProvider = class {
  id = "export_provider";
  label = "Export Analyzer Engine";
  capabilities = {
    listConversations: true,
    readConversation: true,
    archiveConversation: false,
    deleteConversation: false,
    getDates: true,
    getMessageCounts: true
  };
  conversations = [];
  async loadFromJSON(data) {
    this.conversations = data;
  }
  async healthCheck() {
    return {
      ok: true,
      version: "1.0",
      source: "export",
      capabilities: ["listConversations", "readConversation"],
      warnings: [],
      lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async listConversations(cursor) {
    const list = this.conversations.map((c) => ({
      id: c.conversation_id || c.id,
      title: c.title || "Untitled",
      createTime: c.create_time,
      updateTime: c.update_time
    }));
    return { conversations: list };
  }
  async readConversation(id) {
    const convo = this.conversations.find((c) => c.conversation_id === id || c.id === id);
    if (!convo) throw new Error("Not found");
    return {
      id: convo.conversation_id || convo.id,
      title: convo.title || "Untitled",
      messages: Object.values(convo.mapping || {}).map((m) => m.message),
      metadata: {}
    };
  }
  // Returns fully populated candidates
  async generateCandidates() {
    return this.conversations.map((c) => {
      const messages = Object.values(c.mapping || {}).map((m) => m.message).filter(Boolean);
      let userMessages = 0;
      let assistantMessages = 0;
      let hasCode = false;
      messages.forEach((m) => {
        if (m.author?.role === "user") userMessages++;
        if (m.author?.role === "assistant") {
          assistantMessages++;
          if (m.content?.parts?.some((p) => typeof p === "string" && p.includes("```"))) {
            hasCode = true;
          }
        }
      });
      const candidate = {
        id: c.conversation_id || c.id,
        idHash: c.conversation_id || c.id,
        title: c.title || "Untitled",
        url: `https://chatgpt.com/c/${c.conversation_id || c.id}`,
        source: "export",
        sourceConfidence: 1,
        dates: {
          createdAt: c.create_time ? new Date(c.create_time * 1e3).toISOString() : void 0,
          updatedAt: c.update_time ? new Date(c.update_time * 1e3).toISOString() : void 0,
          ageDays: c.update_time ? Math.floor((Date.now() / 1e3 - c.update_time) / 86400) : void 0,
          dateConfidence: c.update_time ? 1 : 0
        },
        counts: {
          userMessages,
          assistantMessages,
          totalMessages: userMessages + assistantMessages,
          countConfidence: 1
        },
        signals: {
          genericTitle: c.title === "New chat",
          duplicateTitle: false,
          // Handle in batch later
          hasCode,
          hasFile: "unknown",
          hasImage: "unknown",
          hasArtifact: "unknown",
          isProject: "unknown",
          isCurrentChat: false,
          protectedKeywordMatches: []
        },
        score: {
          total: 0,
          shortConversation: 0,
          oldAge: 0,
          genericTitle: 0,
          duplicateTitle: 0,
          noFiles: 0,
          noCode: 0,
          noProject: 0,
          noProtectedKeyword: 0,
          lowContentLength: 0,
          confidence: 1
        },
        riskFlags: [],
        recommendation: "ignore",
        selectedAction: "none",
        status: "discovered"
      };
      return candidate;
    });
  }
};

// src/dom-sidebar-provider.ts
import { Selectors } from "@tidygpt/ui-automation";
var DomSidebarProvider = class {
  id = "dom_sidebar_provider";
  label = "Live UI Scanner Engine";
  capabilities = {
    listConversations: true,
    readConversation: false,
    archiveConversation: false,
    deleteConversation: false,
    getDates: false,
    // UI only shows generic "Yesterday", "Previous 7 Days"
    getMessageCounts: false
  };
  async healthCheck() {
    const sidebarExists = !!document.querySelector(Selectors.Sidebar.Container);
    return {
      ok: sidebarExists,
      version: "DOM-based",
      source: "dom",
      capabilities: ["listConversations"],
      warnings: sidebarExists ? [] : ["Sidebar not found"],
      lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async listConversations(cursor) {
    const links = Array.from(document.querySelectorAll(Selectors.Sidebar.ChatLink));
    const conversations = links.map((link) => {
      const url = new URL(link.href);
      const id = url.pathname.replace("/c/", "");
      return {
        id,
        title: link.textContent || "Untitled"
      };
    });
    return { conversations };
  }
  async readConversation(id) {
    throw new Error("DomSidebarProvider cannot read full conversation context.");
  }
};

// src/dom-action-provider.ts
import { executeAction } from "@tidygpt/ui-automation";
var DomActionProvider = class {
  async archive(id) {
    const success = await executeAction(id, "archive");
    return {
      id,
      action: "archive",
      status: success ? "success" : "failed",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async delete(id) {
    const success = await executeAction(id, "delete");
    return {
      id,
      action: "delete",
      status: success ? "success" : "failed",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async verify(id, expected) {
    const stillExists = !!document.querySelector(`a[href*="/c/${id}"]`);
    return {
      status: stillExists ? "failed" : "success"
    };
  }
};
export {
  DomActionProvider,
  DomSidebarProvider,
  ExportProvider
};
