'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  userName: string | null;
  userRole: 'admin' | 'user' | null;
  userAvatar: string | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  setUserAvatar: Dispatch<SetStateAction<string | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      let finalUser: User | null = null;
      let finalUserName: string | null = null;
      let finalUserRole: 'admin' | 'user' | null = null;
      let finalUserAvatar: string | null = null;
      
      if (firebaseUser) {
        finalUser = firebaseUser;
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          finalUserRole = userData.role;
          finalUserName = userData.name;
          finalUserAvatar = userData.avatarUrl || null;
        }
      }
      
      setUser(finalUser);
      setUserName(finalUserName);
      setUserRole(finalUserRole);
      setUserAvatar(finalUserAvatar);
      setIsLoading(false);

      // --- Routing logic is now here ---
      const isAuthPage = pathname === '/' || pathname === '/register';
      if (finalUser && isAuthPage) {
        router.push('/dashboard');
      }
      if (!finalUser && !isAuthPage) {
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  const logout = async () => {
    await signOut(auth);
    // Clear state on logout
    setUser(null);
    setUserName(null);
    setUserRole(null);
    setUserAvatar(null);
    router.push('/');
  };

  const value = {
    user,
    userName,
    userRole,
    userAvatar,
    isLoading,
    logout,
    setUserAvatar
  };

  // While the initial user state is loading, show a loader for protected pages
  if (isLoading && pathname !== '/' && pathname !== '/register') {
     return (
        <div className="flex justify-center items-center h-screen bg-background">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
