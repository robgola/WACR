import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

// Logic
import { AppProvider } from './context/AppContext';
import { useAuth } from './hooks/useAuth';
import { libraryManager } from './services/LibraryManager';

// Page Components
import LandingPage from './components/LandingPage';
import MainLayout from './components/MainLayout';
import SettingsPage from './components/SettingsPage';

/**
 * AppContent handles the core initialization logic and top-level routing.
 * It's nested inside AppProvider and Router.
 */
const AppContent = () => {
  console.log(">>> 🧩 AppContent Mounting...");
  const { activeProfile, activeType, loadingAuth } = useAuth();

  // Initialize LibraryManager with Active Profile whenever it changes
  useEffect(() => {
    if (activeProfile?.url && activeProfile?.username) {
      console.log(`🐛 [App] Initializing LibraryManager for: ${activeType}`);
      libraryManager.initialize(activeType, {
        baseUrl: activeProfile.url,
        username: activeProfile.username,
        password: activeProfile.password
      });
    }
  }, [activeProfile, activeType]);

  // Prevent rendering until authentication state is resolved
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-medium tracking-widest uppercase text-xs opacity-50">Loading Security...</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Root Landing Page / Login */}
      <Route path="/" element={<LandingPage />} />

      {/* Global Settings (Accessible from Landing or Main App) */}
      <Route path="/settings" element={<SettingsPage />} />

      {/* Main Application Shell (Modular Layout) */}
      <Route path="/app/*" element={<MainLayout />} />
    </Routes>
  );
};

/**
 * Main App Entry Point
 * Sets up global Context (AppProvider) and Routing (Router)
 */
const App = () => {
  const base = import.meta.env.BASE_URL;
  console.log(">>> 📦 App Mounting. Base URL:", base);

  return (
    <Router basename={base}>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </Router>
  );
};

export default App;
