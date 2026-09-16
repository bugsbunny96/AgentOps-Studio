/**
 * Augments the Express Request type with AgentOps Studio–specific fields
 * injected by authentication and multi-tenant middleware.
 */
declare namespace Express {
  interface Request {
    /** Authenticated user's MongoDB ObjectId (string form) — set by verifyAuth middleware */
    userId?: string;
    /** Authenticated user's email — set by verifyAuth middleware */
    userEmail?: string;
    /** Active organization's MongoDB ObjectId (string form) — set by validateOrganization middleware */
    orgId?: string;
    /** Active user's role within the current organization — set by validateOrganization middleware */
    userRole?: 'Owner' | 'Admin' | 'Member';
    /**
     * The plan that governs feature access for the current request.
     * Equals org.plan except during an active trial, where it is 'growth'.
     * Set by the trialGate middleware.
     */
    effectivePlan?: 'free' | 'starter' | 'growth' | 'enterprise';
  }
}
