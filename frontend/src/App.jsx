import React, { useState, useEffect } from 'react';
import CitizenDashboard from './components/CitizenDashboard';
import OfficerDashboard from './components/OfficerDashboard';
import AdminDashboard from './components/AdminDashboard';
import LoginPage from './components/LoginPage';
import LoginModal from './components/LoginModal';
import RegisterModal from './components/RegisterModal';
import { AuthProvider, useAuth } from './context/AuthContext';

function RouterApp() {
  const { currentUser, userProfile, userRole } = useAuth();
  const [viewMode, setViewMode] = useState('auto'); // 'auto', 'citizen', 'officer', 'admin', 'login'
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Synchronize active workspace view immediately upon profile/auth state change
  useEffect(() => {
    const path = window.location.pathname.toLowerCase();
    
    if (userProfile || currentUser) {
      const activeRole = userProfile?.role || userRole || 'CITIZEN';
      if (activeRole === 'ADMIN') {
        setViewMode('admin');
        if (!path.includes('/admin')) window.history.replaceState(null, '', '/admin');
      } else if (activeRole === 'OFFICER') {
        setViewMode('officer');
        if (!path.includes('/officer')) window.history.replaceState(null, '', '/officer');
      } else {
        setViewMode('citizen');
        if (!path.includes('/citizen')) window.history.replaceState(null, '', '/citizen');
      }
    } else {
      // Unauthenticated: always route to login page and clean up path
      setViewMode('login');
      if (path !== '/' && path !== '') {
        window.history.replaceState(null, '', '/');
      }
    }
  }, [userRole, userProfile, currentUser]);

  const handleOpenLogin = () => {
    setShowLoginModal(true);
  };

  const handleManualEnterDashboard = (forcedRole = null) => {
    const targetRole = forcedRole || userRole || userProfile?.role || 'CITIZEN';
    if (targetRole === 'ADMIN') {
      setViewMode('admin');
      window.history.pushState(null, '', '/admin');
    } else if (targetRole === 'OFFICER') {
      setViewMode('officer');
      window.history.pushState(null, '', '/officer');
    } else {
      setViewMode('citizen');
      window.history.pushState(null, '', '/citizen');
    }
  };

  // Render standalone Landing/Login page if unauthenticated or in login mode
  if (viewMode === 'login' || (!userProfile && !currentUser)) {
    return (
      <>
        <LoginPage onEnterDashboard={handleManualEnterDashboard} />
        {showLoginModal && (
          <LoginModal
            onClose={() => setShowLoginModal(false)}
            onSuccess={() => handleManualEnterDashboard()}
            onSwitchToRegister={() => {
              setShowLoginModal(false);
              setShowRegisterModal(true);
            }}
          />
        )}
        {showRegisterModal && (
          <RegisterModal
            onClose={() => setShowRegisterModal(false)}
            onSuccess={() => handleManualEnterDashboard()}
            onSwitchToLogin={() => {
              setShowRegisterModal(false);
              setShowLoginModal(true);
            }}
          />
        )}
      </>
    );
  }

  // Render Isolated Dedicated Dashboard Workspaces
  let activeComponent = null;
  const activeRole = userProfile?.role || userRole || 'CITIZEN';

  if (viewMode === 'admin' || (activeRole === 'ADMIN' && viewMode === 'auto')) {
    activeComponent = <AdminDashboard onOpenLogin={handleOpenLogin} />;
  } else if (viewMode === 'officer' || (activeRole === 'OFFICER' && viewMode === 'auto')) {
    activeComponent = <OfficerDashboard onOpenLogin={handleOpenLogin} />;
  } else {
    activeComponent = <CitizenDashboard onOpenLogin={handleOpenLogin} />;
  }

  return (
    <>
      {activeComponent}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => handleManualEnterDashboard()}
          onSwitchToRegister={() => {
            setShowLoginModal(false);
            setShowRegisterModal(true);
          }}
        />
      )}
      {showRegisterModal && (
        <RegisterModal
          onClose={() => setShowRegisterModal(false)}
          onSuccess={() => handleManualEnterDashboard()}
          onSwitchToLogin={() => {
            setShowRegisterModal(false);
            setShowLoginModal(true);
          }}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RouterApp />
    </AuthProvider>
  );
}
