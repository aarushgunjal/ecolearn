/* eslint-disable react-refresh/only-export-components -- this provider intentionally exports its paired consumer hook. */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { type AuthError, type Session, type User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setRememberMe } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string, remember?: boolean) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, remember?: boolean) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: (remember?: boolean) => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Keeping this dynamic makes Google OAuth return to the same deployed preview,
// custom domain, or localhost instance that initiated the sign-in.
const getRedirectUrl = () => window.location.origin;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch((error: unknown) => {
        console.error("Unable to restore session:", error);
      })
      .finally(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string, remember = true) => {
    setRememberMe(remember);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Error signing in",
        description: error.message,
        variant: "destructive",
      });
    }

    return { error };
  };

  const signUp = async (email: string, password: string, remember = true) => {
    setRememberMe(remember);
    const redirectUrl = `${getRedirectUrl()}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      toast({
        title: "Error signing up",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Check your email",
        description:
          "We sent you a confirmation link. Please check your email to verify your account.",
      });
    }

    return { error };
  };

  const signInWithGoogle = async (remember = true) => {
    setRememberMe(remember);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getRedirectUrl()}/`,
      },
    });

    if (error) {
      toast({
        title: "Error signing in with Google",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const signInWithGithub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${getRedirectUrl()}/`,
      },
    });

    if (error) {
      toast({
        title: "Error signing in with GitHub",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithGithub,
        signOut,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
