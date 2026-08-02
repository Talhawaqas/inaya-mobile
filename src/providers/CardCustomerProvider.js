// src/providers/CardCustomerProvider.js
//
// Card customers (Stripe checkout, no wallet) never had their plan status
// actually surfaced anywhere in the mobile app -- BusinessModelScreen's
// checkout success handler only showed a one-time static message, and
// MyDashboardScreen had no branch for a card customer at all (wallet-only).
// Mirrors the web dApp's page.js pattern exactly, just swapping its
// http-only-cookie identity (mobile's fetch and its CheckoutWebView don't
// share a cookie jar) for an AsyncStorage-persisted email instead.
//
// A context provider rather than a plain hook: React Navigation keeps
// visited tabs mounted, so if BusinessModelScreen resolves a new email
// after checkout, an already-mounted MyDashboardScreen with its own
// independent hook instance would never see it (its one-time mount effect
// already ran). One shared provider at the app root is the single source
// of truth both screens read from.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CARD_CUSTOMER_EMAIL_KEY = 'inaya_card_customer_email';
const API_BASE = 'https://www.inayanetwork.com';
const MAX_ATTEMPTS = 12; // ~60s at 5s apart -- the webhook runs real on-chain
// settlement transactions (RevenueRouter, then CorporateEscrow) before writing
// to the database, which can easily take 10-30s+ on testnet.

const CardCustomerContext = createContext(null);

export function CardCustomerProviderRoot({ children }) {
  const [email, setEmail] = useState(null);
  const [plan, setPlan] = useState(null);
  const [polling, setPolling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Recognize a returning card customer on this device without them having
  // to check out again -- same idea as the web dApp's whoami cookie check.
  useEffect(() => {
    AsyncStorage.getItem(CARD_CUSTOMER_EMAIL_KEY)
      .then((stored) => { if (stored) setEmail(stored); })
      .catch(() => {});
  }, []);

  // Call this from a checkout-success handler with the sessionId Stripe
  // appended to the redirect URL -- resolves it to the customer's email
  // (Stripe already collected it on the card form) and persists it.
  const resolveFromCheckout = useCallback(async (sessionId) => {
    if (!sessionId) return null;
    try {
      const res = await fetch(`${API_BASE}/api/resolve-checkout-session?session_id=${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      if (data.email) {
        setEmail(data.email);
        setPlan(null); // reset in case this is a plan change, not a first purchase
        await AsyncStorage.setItem(CARD_CUSTOMER_EMAIL_KEY, data.email);
      }
      return data.email || null;
    } catch (err) {
      console.warn('resolve-checkout-session failed:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    let attempts = 0;
    setTimedOut(false);
    setPolling(true);

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const res = await fetch(`${API_BASE}/api/corporate-plan-status?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (data.active) {
          if (!cancelled) { setPlan(data); setPolling(false); }
          return; // found it, stop polling
        }
      } catch (err) {
        console.warn('corporate-plan-status fetch failed:', err);
      }
      if (attempts < MAX_ATTEMPTS && !cancelled) {
        setTimeout(poll, 5000);
      } else if (!cancelled) {
        setPolling(false);
        setTimedOut(true); // gave up -- something needs a human to look at it
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [email]);

  const value = { email, plan, polling, timedOut, resolveFromCheckout };
  return <CardCustomerContext.Provider value={value}>{children}</CardCustomerContext.Provider>;
}

export function useCardCustomer() {
  const ctx = useContext(CardCustomerContext);
  if (!ctx) throw new Error('useCardCustomer must be used inside CardCustomerProviderRoot.');
  return ctx;
}
