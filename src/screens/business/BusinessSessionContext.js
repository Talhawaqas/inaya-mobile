// src/screens/business/BusinessSessionContext.js
//
// Holds the signed-in Business Workspace session (email + org memberships,
// same shape GET /api/orgs/session returns) and a signOut() action, so
// every screen deeper in the stack (Departments/Projects/Documents/...)
// doesn't need session/orgId threaded through navigation params by hand.

import React, { createContext, useContext } from 'react';

const BusinessSessionContext = createContext(null);

export function BusinessSessionProvider({ session, signOut, children }) {
  return (
    <BusinessSessionContext.Provider value={{ session, signOut }}>
      {children}
    </BusinessSessionContext.Provider>
  );
}

export function useBusinessSession() {
  const ctx = useContext(BusinessSessionContext);
  if (!ctx) throw new Error('useBusinessSession must be used within BusinessSessionProvider');
  return ctx;
}
