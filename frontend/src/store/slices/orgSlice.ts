import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Organization, UserRole, MemberPermissions, DEFAULT_MEMBER_PERMISSIONS } from '@/types';

interface OrgState {
  currentOrg:         Organization | null;
  currentRole:        UserRole | null;
  /** Null for Owners (they have full access); populated for Members. */
  currentPermissions: MemberPermissions | null;
  availableOrgs:      Organization[];
  onboarding: {
    activeStep: number;
    tempOrgId:  string | null;
  };
}

const initialState: OrgState = {
  currentOrg:         null,
  currentRole:        null,
  currentPermissions: null,
  availableOrgs:      [],
  onboarding: {
    activeStep: 0,
    tempOrgId:  null,
  },
};

const orgSlice = createSlice({
  name: 'org',
  initialState,
  reducers: {
    setCurrentOrg(
      state,
      action: PayloadAction<{
        org:         Organization;
        role:        UserRole;
        permissions?: MemberPermissions | null;
      }>
    ) {
      state.currentOrg  = action.payload.org;
      state.currentRole = action.payload.role;
      // Owners always have full access — null permissions signals "no restrictions"
      state.currentPermissions =
        action.payload.role === 'Owner'
          ? null
          : (action.payload.permissions ?? { ...DEFAULT_MEMBER_PERMISSIONS });
      // Persist for the axios interceptor
      try {
        localStorage.setItem('activeOrgId', action.payload.org.id);
      } catch { /* ignore */ }
    },
    clearCurrentOrg(state) {
      state.currentOrg         = null;
      state.currentRole        = null;
      state.currentPermissions = null;
      try { localStorage.removeItem('activeOrgId'); } catch { /* ignore */ }
    },
    setAvailableOrgs(state, action: PayloadAction<Organization[]>) {
      state.availableOrgs = action.payload;
    },
    setOnboardingStep(state, action: PayloadAction<number>) {
      state.onboarding.activeStep = action.payload;
    },
    setTempOrgId(state, action: PayloadAction<string | null>) {
      state.onboarding.tempOrgId = action.payload;
    },
  },
});

export const {
  setCurrentOrg,
  clearCurrentOrg,
  setAvailableOrgs,
  setOnboardingStep,
  setTempOrgId,
} = orgSlice.actions;
export default orgSlice.reducer;
