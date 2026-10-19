import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getAuthCode } from '@/auth/callback';

export function authRedirectUrl() {
  return Platform.OS === 'web' ? `${window.location.origin}/auth/callback` : 'mejordia://auth/callback';
}
// Router and the native browser can deliver the same return URL concurrently.
let lastExchange: { code: string; promise: Promise<void> } | null = null;
export function finishGoogleSignIn(url: string) {
  const client = supabase;
  if (!client) return Promise.reject(new Error('Falta configurar Supabase.'));
  const code = getAuthCode(url, authRedirectUrl());
  if (lastExchange?.code === code) return lastExchange.promise;
  const promise = client.auth.exchangeCodeForSession(code).then(({ error }) => {
    if (error) throw new Error('No pudimos completar el acceso. Vuelve a iniciar sesión.');
  });
  lastExchange = { code, promise };
  return promise;
}

type Auth = {
  session: Session | null; ready: boolean; busy: boolean; error: string | null;
  signIn: () => Promise<void>; signOut: () => Promise<void>;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    let receivedEvent = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, value) => {
      receivedEvent = true;
      if (active) { setSession(value); setReady(true); }
    });
    client.auth.getSession().then(({ data, error: loadError }) => {
      if (!active) return;
      if (!receivedEvent) setSession(data.session);
      if (loadError) setError('No pudimos recuperar tu sesión. Vuelve a iniciar sesión.');
      setReady(true);
    }).catch(() => { if (active) { setReady(true); setError('No pudimos recuperar tu sesión.'); } });
    const refresh = () => {
      if (AppState.currentState === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    const listener = Platform.OS !== 'web' ? AppState.addEventListener('change', refresh) : null;
    if (Platform.OS !== 'web') refresh();
    return () => { active = false; subscription.unsubscribe(); listener?.remove(); if (Platform.OS !== 'web') client.auth.stopAutoRefresh(); };
  }, []);
  const userId = session?.user.id;
  useEffect(() => {
    const client = supabase;
    if (!client || !userId) return;
    let active = true;
    let request = 0;
    const refreshProfile = async () => {
      const currentRequest = ++request;
      try {
        const { data, error: profileError } = await client.auth.getUser();
        if (!active || currentRequest !== request || profileError || data.user?.id !== userId) return;
        const user = data.user;
        setSession((current) => current?.user.id === userId ? { ...current, user } : current);
      } catch { /* Keep the cached profile when offline. */ }
    };
    void refreshProfile();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refreshProfile(); });
    const onFocus = () => { void refreshProfile(); };
    if (Platform.OS === 'web') window.addEventListener('focus', onFocus);
    return () => { active = false; listener.remove(); if (Platform.OS === 'web') window.removeEventListener('focus', onFocus); };
  }, [userId]);
  async function run(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setBusy(true); setError(null);
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos conectar. Inténtalo de nuevo.'); }
    finally { working.current = false; setBusy(false); }
  }
  async function signIn() {
    await run(async () => {
      if (!supabase) throw new Error('Falta configurar Supabase en .env.local.');
      if (Platform.OS !== 'web' && Constants.appOwnership === 'expo') {
        throw new Error('Para probar Google usa la vista web o una compilación de desarrollo de Día Uno.');
      }
      const redirectTo = authRedirectUrl();
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google', options: { redirectTo, skipBrowserRedirect: true },
      });
      if (authError || !data.url) throw new Error('No pudimos abrir Google. Revisa el proveedor en Supabase y tu conexión.');
      if (Platform.OS === 'web') { window.location.assign(data.url); return; }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') await finishGoogleSignIn(result.url);
    });
  }
  async function signOut() {
    await run(async () => {
      if (!supabase) return;
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw new Error('No pudimos cerrar la sesión. Inténtalo de nuevo.');
    });
  }
  return <Context.Provider value={{ session, ready, busy, error, signIn, signOut }}>{children}</Context.Provider>;
}
export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error('AuthProvider is required');
  return auth;
}
