// src/screens/business/BusinessSessionContext.js
//
// Holds the signed-in Business Workspace session (email + org memberships,
// same shape GET /api/orgs/session returns), a signOut() action, and a
// refreshSession() action, so every screen deeper in the stack
// (Departments/Projects/Documents/... and OrgHomeScreen's create-company
// form) doesn't need session/orgId threaded through navigation params by
// hand, and can pick up a newly-created org without a full app reload.

import React, { createContext, useContext } from 'react';

const BusinessSessionContext = createContext(null);

export function BusinessSessionProvider({ session, signOut, refreshSession, children }) {
  return (
    <BusinessSessionContext.Provider value={{ session, signOut, refreshSession }}>
      {children}
    </BusinessSessionContext.Provider>
  );
}

export function useBusinessSession() {
  const ctx = useContext(BusinessSessionContext);
  if (!ctx) throw new Error('useBusinessSession must be used within BusinessSessionProvider');
  return ctx;
}
