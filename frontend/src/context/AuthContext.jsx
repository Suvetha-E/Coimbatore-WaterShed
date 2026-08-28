import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const stored = localStorage.getItem('user_profile');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });
  const [idToken, setIdToken] = useState(localStorage.getItem('auth_token') || '');
  const [loading, setLoading] = useState(true);

  // Synchronize React state and localStorage profile
  const loginWithProfile = (profileData, token) => {
    if (token) {
      setIdToken(token);
      localStorage.setItem('auth_token', token);
    }
    if (profileData) {
      setUserProfile(profileData);
      localStorage.setItem('user_profile', JSON.stringify(profileData));
    }
  };

  // Sync user profile with FastAPI backend
  const syncBackendUser = async (user, name = null, role = 'CITIZEN', phone = null) => {
    try {
      const token = await user.getIdToken();
      setIdToken(token);
      localStorage.setItem('auth_token', token);

      const res = await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          firebase_uid: user.uid,
          email: user.email,
          name: name || user.displayName || user.email.split('@')[0],
          phone: phone || '',
          role: role
        })
      });

      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.user);
        localStorage.setItem('user_profile', JSON.stringify(data.user));
        return data.user;
      }
    } catch (err) {
      console.error('Failed to sync user with backend:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          setIdToken(token);
          localStorage.setItem('auth_token', token);
          await syncBackendUser(user);
        } catch (e) {
          console.error('Error fetching token:', e);
        }
      } else {
        const token = localStorage.getItem('auth_token');
        const stored = localStorage.getItem('user_profile');
        if (token && stored) {
          try {
            setUserProfile(JSON.parse(stored));
            setIdToken(token);
          } catch (e) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_profile');
            setUserProfile(null);
            setIdToken('');
          }
        } else {
          setUserProfile(null);
          setIdToken('');
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    const res = await signInWithEmailAndPassword(auth, email, password);
    const profile = await syncBackendUser(res.user);
    return profile;
  };

  const register = async (email, password, name, role = 'CITIZEN', phone = '') => {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(res.user, { displayName: name });
    const profile = await syncBackendUser(res.user, name, role, phone);
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Post-register signout notice:", e);
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_profile');
    setCurrentUser(null);
    setUserProfile(null);
    setIdToken('');
    return profile;
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("SignOut notice:", e);
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_profile');
    setCurrentUser(null);
    setUserProfile(null);
    setIdToken('');
    window.history.pushState(null, '', '/');
  };

  const value = {
    currentUser,
    userProfile,
    idToken,
    userRole: userProfile?.role || 'CITIZEN',
    approvalStatus: userProfile?.approval_status || 'approved',
    login,
    register,
    logout,
    setUserProfile,
    loginWithProfile,
    setIdToken
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
