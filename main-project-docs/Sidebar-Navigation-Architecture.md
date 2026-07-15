# Sidebar Navigation Architecture - AgentOps Studio

## 1. Purpose
The sidebar is the primary navigation surface for authenticated users in the AgentOps Studio SaaS shell. It must be role-aware, organization-aware, responsive, accessible, and driven by backend configuration rather than hardcoded menu logic.

## 2. Navigation Structure

### Command Center
* Dashboard
* Communications
* Analytics & Reports

### AI Management
* My Agents
  * Live Agents
  * Create Agent
  * Agent Templates
* Knowledge Engine

### Administration
* User Management
* Billing & Usage
* Advanced Settings

### Support & Training
* Documentation
* Tutorials
* Support Center

## 3. Functional Workflow
* Desktop renders a persistent sidebar rail.
* Tablet renders a compact icon-first rail.
* Mobile renders the same hierarchy inside a slide-over drawer.
* Parent groups expand and collapse independently.
* The active route is highlighted at both the group and item level.
* Sidebar state persists per user and organization, including collapse and pinned state.
* Route selection on mobile closes the drawer automatically.

## 4. User Flows
* **Owner**: full navigation access, including billing and advanced settings.
* **Admin**: operational access to agents, users, knowledge engine, and support; billing can be restricted by plan.
* **Team Member**: access to allowed command center pages, knowledge engine if granted, and support content.
* **Agent Manager**: works mainly inside My Agents and Analytics & Reports.
* **Knowledge Base Manager**: works mainly inside Knowledge Engine.
* **Billing Operator**: works mainly inside Billing & Usage.
* **Settings Operator**: works mainly inside Advanced Settings.

## 5. Backend Flow
* Navigation payload is fetched after organization context is resolved.
* The backend validates membership, role, onboarding status, subscription plan, and feature flags.
* The server returns only the menu tree allowed for the current user and tenant.
* Navigation interactions are logged for analytics and auditability.

## 6. Database Requirements

### Organizations
* `name`
* `slug`
* `timezone`
* `subscriptionPlanId`
* `onboardingStatus`

### Users
* `name`
* `email`
* `status`

### Roles / Memberships
* `userId`
* `organizationId`
* `role`

### Navigation Configurations
* `organizationId`
* `sections`
* `items`
* `route`
* `requiredRoles`
* `featureFlagKey`

### Feature Flags
* `organizationId`
* `key`
* `enabled`
* `rolloutStrategy`

### Subscription Plans
* `key`
* `name`
* `featureAccess`
* `maxUsers`
* `maxAgents`

## 7. API Requirements

### Get Sidebar Configuration
* **Method**: `GET`
* **Route**: `/api/v1/navigation/sidebar`
* **Request**: Organization context header or path context plus auth cookie
* **Response**: Normalized sidebar tree with visibility metadata
* **Authorization**: Authenticated membership in the active organization

### Get User Permissions
* **Method**: `GET`
* **Route**: `/api/v1/users/me/permissions`
* **Request**: Current user context
* **Response**: Role, allowed actions, feature entitlements
* **Authorization**: Authenticated user

### Check Navigation Access
* **Method**: `POST`
* **Route**: `/api/v1/navigation/access-check`
* **Request**: `{ route, organizationId }`
* **Response**: Access allowed or denied with reason codes
* **Authorization**: Authenticated membership in the active organization

### Get Feature Flags
* **Method**: `GET`
* **Route**: `/api/v1/feature-flags`
* **Request**: Active organization context
* **Response**: Enabled flags for the current tenant
* **Authorization**: Authenticated membership and organization access

### Get Organization Settings
* **Method**: `GET`
* **Route**: `/api/v1/organizations/:id/settings`
* **Request**: Organization identifier
* **Response**: Operational settings, plan, and sidebar-relevant overrides
* **Authorization**: Owner or Admin depending on the setting group

## 8. Validation Rules
* Users must be authenticated before the sidebar payload is served.
* The active organization must match the user's membership.
* Role checks must be evaluated before route visibility is returned.
* Tenant isolation must block cross-organization navigation payload access.
* Feature flags must be evaluated before menu items render.
* Inactive onboarding states must hide operational routes until completion.

## 9. Acceptance Criteria
* Sidebar displays the approved hierarchy for every authenticated user.
* Unauthorized routes never appear in the menu payload.
* Desktop, tablet, and mobile layouts preserve the same navigation structure.
* Keyboard-only navigation works across all visible menu items.
* Active route highlighting remains correct after refresh and deep links.
* Navigation payloads are returned under the correct organization context.
