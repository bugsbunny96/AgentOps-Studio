/**
 * 🟣 Test Engineer — orgSlice unit tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import orgReducer, {
  setCurrentOrg,
  clearCurrentOrg,
  setAvailableOrgs,
  setOnboardingStep,
  setTempOrgId,
} from '@/store/slices/orgSlice';
import type { Organization } from '@/types';

const mockOrg: Organization = {
  id: 'org-1',
  name: 'Test Corp',
  slug: 'test-corp',
  timezone: 'Asia/Kolkata',
  industry: 'Technology',
  onboardingStatus: 'COMPLETED',
  hasWebsite: true,
  websiteUrl: 'https://test.com',
  supportedLanguages: ['en-US', 'hi-IN'],
  businessHours: { start: '09:00', end: '18:00' },
  createdAt: new Date().toISOString(),
};

function makeStore() {
  return configureStore({ reducer: { org: orgReducer } });
}

describe('orgSlice', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
    window.localStorage.clear();
  });

  it('has correct initial state', () => {
    const { org } = store.getState();
    expect(org.currentOrg).toBeNull();
    expect(org.currentRole).toBeNull();
    expect(org.availableOrgs).toEqual([]);
    expect(org.onboarding.activeStep).toBe(0);
    expect(org.onboarding.tempOrgId).toBeNull();
  });

  it('setCurrentOrg sets org and role', () => {
    store.dispatch(setCurrentOrg({ org: mockOrg, role: 'Owner' }));
    const { org } = store.getState();

    expect(org.currentOrg).toEqual(mockOrg);
    expect(org.currentRole).toBe('Owner');
  });

  it('setCurrentOrg persists orgId to localStorage', () => {
    store.dispatch(setCurrentOrg({ org: mockOrg, role: 'Admin' }));

    expect(window.localStorage.getItem('activeOrgId')).toBe('org-1');
  });

  it('clearCurrentOrg nulls org and role', () => {
    store.dispatch(setCurrentOrg({ org: mockOrg, role: 'Owner' }));
    store.dispatch(clearCurrentOrg());
    const { org } = store.getState();

    expect(org.currentOrg).toBeNull();
    expect(org.currentRole).toBeNull();
  });

  it('clearCurrentOrg removes activeOrgId from localStorage', () => {
    store.dispatch(setCurrentOrg({ org: mockOrg, role: 'Owner' }));
    store.dispatch(clearCurrentOrg());

    expect(window.localStorage.getItem('activeOrgId')).toBeNull();
  });

  it('setAvailableOrgs updates the list', () => {
    store.dispatch(setAvailableOrgs([mockOrg]));
    expect(store.getState().org.availableOrgs).toHaveLength(1);
    expect(store.getState().org.availableOrgs[0].id).toBe('org-1');
  });

  it('setOnboardingStep updates activeStep', () => {
    store.dispatch(setOnboardingStep(3));
    expect(store.getState().org.onboarding.activeStep).toBe(3);
  });

  it('setTempOrgId updates tempOrgId', () => {
    store.dispatch(setTempOrgId('temp-org-xyz'));
    expect(store.getState().org.onboarding.tempOrgId).toBe('temp-org-xyz');
  });

  it('setTempOrgId can be cleared to null', () => {
    store.dispatch(setTempOrgId('temp-org-xyz'));
    store.dispatch(setTempOrgId(null));
    expect(store.getState().org.onboarding.tempOrgId).toBeNull();
  });
});
