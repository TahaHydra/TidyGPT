import { ConversationCandidate, CandidateScore, RulesConfig } from '@tidygpt/shared';

declare function calculateScore(candidate: Partial<ConversationCandidate>, settings: any): CandidateScore;
declare function classifyScore(score: CandidateScore, ruleOverride?: "archive" | "delete" | "keep" | "none"): "strong_archive_candidate" | "archive_candidate" | "delete_candidate" | "manual_review" | "ignore" | "protected" | "uncertain";

declare function evaluateRules(candidate: Partial<ConversationCandidate>, config: RulesConfig): "archive" | "delete" | "keep" | "none";

export { calculateScore, classifyScore, evaluateRules };
