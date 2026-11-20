import {
  onIdTokenChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { auth, googleAuthProvider } from '../lib/firebase';
import {
  setAuthTokenProvider,
  wmsApi,
  type AuthUserProfile,
} from '../services/wmsApi';

interface AuthContextValue {
  user: AuthUserProfile | null;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  clearAuthError: () => void;
  loginWithPassword: (username: string, password: string) => Promise<void>;
  registerWithPassword: (input: {
    username: string;
    password: string;
    displayName?: string;
  }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapFirebaseUser(fbUser: FirebaseUser): AuthUserProfile {
  return {
    uid: fbUser.uid,
    username: null,
    email: fbUser.email || '',
    displayName: fbUser.displayName || fbUser.email || 'Google 用户',
    authProvider: 'google',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const firebaseUserRef = useRef<FirebaseUser | null>(null);
  const localTokenRef = useRef<string | null>(null);
  const providerRef = useRef<'google' | 'password' | null>(null);

  useEffect(() => {
    setAuthTokenProvider(async () => {
      if (providerRef.current === 'password') {
        return localTokenRef.current;
      }
      if (firebaseUserRef.current) {
        return await firebaseUserRef.current.getIdToken();
      }
      return localTokenRef.current;
    });
  }, []);

  useEffect(() => {
    let active = true;
    let firebaseResolved = false;
    let localResolved = false;

    const finishInitIfReady = () => {
      if (active && firebaseResolved && localResolved) {
        setLoading(false);
      }
    };

    // Check existing custom-account HttpOnly session cookie on load
    wmsApi
      .authMe()
      .then((res) => {
        if (!active) return;
        if (res.user && res.user.authProvider === 'password') {
          providerRef.current = 'password';
          setUser(res.user);
        }
      })
      .catch(() => {
        // No active local cookie session
      })
      .finally(() => {
        localResolved = true;
        finishInitIfReady();
      });

    const unsubscribe = onIdTokenChanged(auth, async (nextFbUser) => {
      firebaseUserRef.current = nextFbUser;
      if (nextFbUser) {
        try {
          await nextFbUser.getIdToken();
          if (active && providerRef.current !== 'password') {
            providerRef.current = 'google';
            localTokenRef.current = null;
            setUser(mapFirebaseUser(nextFbUser));
          }
        } catch (err) {
          console.error('Failed to acquire Firebase ID token:', err);
        }
      } else if (providerRef.current === 'google') {
        providerRef.current = null;
        if (active) setUser(null);
      }
      firebaseResolved = true;
      finishInitIfReady();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const loginWithPassword = useCallback(async (username: string, password: string) => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const res = await wmsApi.authLogin({ username, password });
      localTokenRef.current = res.token;
      providerRef.current = 'password';
      setUser(res.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登录失败，请检查账号和密码。';
      setAuthError(msg);
      throw err;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const registerWithPassword = useCallback(
    async (input: { username: string; password: string; displayName?: string }) => {
      setSigningIn(true);
      setAuthError(null);
      try {
        const res = await wmsApi.authRegister(input);
        localTokenRef.current = res.token;
        providerRef.current = 'password';
        setUser(res.user);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '注册失败，请稍后重试。';
        setAuthError(msg);
        throw err;
      } finally {
        setSigningIn(false);
      }
    },
    []
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await wmsApi.authChangePassword({ currentPassword, newPassword });
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      await cred.user.getIdToken();
      firebaseUserRef.current = cred.user;
      localTokenRef.current = null;
      providerRef.current = 'google';
      setUser(mapFirebaseUser(cred.user));
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('已取消登录窗口，请重新点击登录。');
      } else if (code === 'auth/popup-blocked') {
        setAuthError('浏览器拦截了登录弹窗，请允许弹窗后重试。');
      } else {
        setAuthError('Google 登录未完成，请稍后重试。');
      }
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    const activeProvider = providerRef.current;
    try {
      if (activeProvider === 'password') {
        await wmsApi.authLogout().catch(() => undefined);
      }
      if (firebaseUserRef.current) {
        await firebaseSignOut(auth).catch(() => undefined);
      }
    } finally {
      firebaseUserRef.current = null;
      localTokenRef.current = null;
      providerRef.current = null;
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signingIn,
        authError,
        clearAuthError,
        loginWithPassword,
        registerWithPassword,
        changePassword,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
