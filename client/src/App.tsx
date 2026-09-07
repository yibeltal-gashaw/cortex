import React, { useState, useEffect, useRef } from 'react';
import { NavRail } from './components/NavRail.js';
import { Sidebar } from './components/Sidebar.js';
import { HudHeader } from './components/HudHeader.js';
import { Timeline } from './components/Timeline.js';
import { TelemetrySidebar } from './components/TelemetrySidebar.js';
import { ArtifactsTab } from './components/ArtifactsTab.js';
import { DatabaseTab } from './components/DatabaseTab.js';
import { DeleteModal } from './components/DeleteModal.js';
import { SettingsPage } from './components/SettingsPage.js';
import { PermissionsProvider } from './context/PermissionsContext.js';
import { JitConsentModal } from './components/JitConsentModal.js';
import { useAgentPermissions } from './hooks/useAgentPermissions.js';
import {
  AppStatus,
  ConversationSummary,
  ParsedConversationSession,
  ArtifactOverview,
  DatabaseInfo
} from './types/index.js';
import {
  fetchStatus,
  fetchConversations,
  fetchConversation,
  fetchArtifacts,
  fetchDatabaseInfo
} from './api/index.js';
import { Loader2, MessageSquare } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentView, setCurrentView } = useAgentPermissions();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('cortex_theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  const [status, setStatus] = useState<AppStatus | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [totalConversations, setTotalConversations] = useState<number>(0);
  const [workspaces, setWorkspaces] = useState<{ name: string; count: number }[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [session, setSession] = useState<ParsedConversationSession | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactOverview | null>(null);
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'artifacts' | 'db'>('timeline');
  const [focusedFile, setFocusedFile] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(false);

  // Real-time Live Polling & Refresh State
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('cortex_auto_refresh_enabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(() => {
    const saved = localStorage.getItem('cortex_auto_refresh_interval');
    const parsed = saved ? parseInt(saved, 10) : 5;
    return [3, 5, 10, 30].includes(parsed) ? parsed : 5;
  });
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(new Date());
  const isRefreshingRef = useRef<boolean>(false);

  const [isTelemetryOpen, setIsTelemetryOpen] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth > 1024 : true;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('cortex_sidebar_collapsed');
    if (saved !== null) return saved === 'true';
    return typeof window !== 'undefined' ? window.innerWidth <= 1024 : false;
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('cortex_sidebar_collapsed', String(next));
      return next;
    });
  };

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(prev => {
      const next = !prev;
      localStorage.setItem('cortex_auto_refresh_enabled', String(next));
      return next;
    });
  };

  const changeAutoRefreshInterval = (sec: number) => {
    setAutoRefreshInterval(sec);
    localStorage.setItem('cortex_auto_refresh_interval', String(sec));
  };

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
          return;
        }
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Apply theme to document root and sync with Electron titlebar overlay
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cortex_theme', theme);
    if (typeof window !== 'undefined' && window.electronAPI?.updateTitleBarOverlay) {
      window.electronAPI.updateTitleBarOverlay(theme === 'dark');
    }
  }, [theme]);

  // Add is-electron class to root if running in desktop app
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
      document.documentElement.classList.add('is-electron');
    }
  }, []);

  const loadAppStatus = async () => {
    try {
      const s = await fetchStatus();
      setStatus(s);
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  };

  // Refresh conversation list and current session
  const refreshData = async (options?: { force?: boolean; silent?: boolean }) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    if (!options?.silent) {
      setIsRefreshing(true);
    }

    try {
      // 1. Fetch updated conversations list
      const data = await fetchConversations({
        searchQuery,
        workspace: selectedWorkspace,
        limit: 150,
        forceRefresh: options?.force
      });

      setConversations(data.conversations);
      setTotalConversations(data.total);
      setWorkspaces(data.workspaces);

      // Auto-select first conversation if none selected
      if (!selectedId && data.conversations.length > 0) {
        selectConversation(data.conversations[0].id);
      } else if (selectedId) {
        // 2. Silently update current active session without flashing loading spinner
        try {
          const promises: Promise<any>[] = [fetchConversation(selectedId)];
          if (activeSubTab === 'artifacts') {
            promises.push(fetchArtifacts(selectedId).catch(() => null));
          } else if (activeSubTab === 'db') {
            promises.push(fetchDatabaseInfo(selectedId).catch(() => null));
          }

          const results = await Promise.all(promises);
          const sessData = results[0];
          if (sessData) {
            setSession(sessData);
          }
          if (activeSubTab === 'artifacts' && results[1]) {
            setArtifacts(results[1]);
          } else if (activeSubTab === 'db' && results[1]) {
            setDbInfo(results[1]);
          }
        } catch (sessErr) {
          console.error('Error refreshing active session details:', sessErr);
        }
      }

      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to refresh data:', err);
    } finally {
      isRefreshingRef.current = false;
      if (!options?.silent) {
        setTimeout(() => setIsRefreshing(false), 300);
      }
    }
  };

  // Load initial status and conversation list on filter changes
  useEffect(() => {
    loadAppStatus();
    refreshData({ force: true });
  }, [selectedWorkspace, searchQuery]);

  // Live polling interval effect
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const intervalId = setInterval(() => {
      // Pause if document/window is hidden
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshData({ silent: true });
    }, autoRefreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [autoRefreshEnabled, autoRefreshInterval, selectedId, selectedWorkspace, searchQuery, activeSubTab]);

  // Instant sync on window focus or visibility change
  useEffect(() => {
    const handleFocusOrVisible = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        refreshData({ silent: true });
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [selectedId, selectedWorkspace, searchQuery, activeSubTab]);

  // Keyboard shortcut R or Ctrl+R / Cmd+R to refresh
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || target?.isContentEditable;

      // Ctrl+R or Cmd+R
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        refreshData({ force: true });
        return;
      }

      // Single key 'r' when not typing in an input
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'r' && !isInput) {
        e.preventDefault();
        refreshData({ force: true });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, selectedWorkspace, searchQuery, activeSubTab]);

  const selectConversation = async (id: string, subTab: 'timeline' | 'artifacts' | 'db' = 'timeline') => {
    setSelectedId(id);
    setActiveSubTab(subTab);
    setLoadingSession(true);
    try {
      const [sessData, artData, dbData] = await Promise.all([
        fetchConversation(id),
        fetchArtifacts(id).catch(() => null),
        fetchDatabaseInfo(id).catch(() => null)
      ]);
      setSession(sessData);
      setArtifacts(artData);
      setDbInfo(dbData);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load conversation details:', err);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleConversationDeleted = (deletedId: string) => {
    setConversations(prev => prev.filter(c => c.id !== deletedId));
    setTotalConversations(prev => Math.max(0, prev - 1));
    if (selectedId === deletedId) {
      setSelectedId(null);
      setSession(null);
      setArtifacts(null);
      setDbInfo(null);
      refreshData({ force: true });
    }
  };

  const currentWorkspaceName = (() => {
    if (selectedWorkspace !== 'all') return selectedWorkspace;
    if (session?.environmentSnapshot?.activeDocument?.path) {
      const pathParts = session.environmentSnapshot.activeDocument.path.replace(/\\/g, '/').split('/');
      const projIdx = pathParts.findIndex(p => p.toLowerCase() === 'project' || p.toLowerCase() === 'projects');
      if (projIdx !== -1 && pathParts[projIdx + 1]) {
        return pathParts[projIdx + 1];
      }
    }
    return 'Acme Platform';
  })();

  return (
    <div className="cortex-hud-root">
      {/* 1. Far-Left Slim Icon Navigation Rail */}
      <NavRail
        currentView={currentView}
        onSelectView={(view) => {
          setIsSettingsOpen(false);
          if (view === 'permissions') {
            setCurrentView('permissions');
            if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
              setIsSidebarCollapsed(true);
            }
          } else {
            if (currentView === 'conversations') {
              toggleSidebar();
            } else {
              setCurrentView('conversations');
              if (isSidebarCollapsed && typeof window !== 'undefined' && window.innerWidth > 1024) {
                setIsSidebarCollapsed(false);
                localStorage.setItem('cortex_sidebar_collapsed', 'false');
              }
            }
          }
        }}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        onOpenSettings={() => {
          if (currentView !== 'conversations') {
            setCurrentView('conversations');
          }
          setIsSettingsOpen(prev => !prev);
        }}
        isSettingsOpen={isSettingsOpen}
        status={status}
      />

      {/* 2. Main Multi-Pane Content */}
      <div className="cortex-hud-body">
          {/* Mobile Backdrops for Left Drawer and Right Drawer */}
          {!isSidebarCollapsed && (
            <div
              className="hud-drawer-backdrop visible"
              onClick={() => {
                setIsSidebarCollapsed(true);
                localStorage.setItem('cortex_sidebar_collapsed', 'true');
              }}
              aria-label="Dismiss sidebar overlay"
            />
          )}

          {isTelemetryOpen && (
            <div
              className="hud-telemetry-backdrop visible"
              onClick={() => setIsTelemetryOpen(false)}
              aria-label="Dismiss details overlay"
            />
          )}

          {/* Column 2: Sessions Drawer */}
          <Sidebar
            conversations={conversations}
            workspaces={workspaces}
            selectedId={selectedId}
            selectedWorkspace={selectedWorkspace}
            searchQuery={searchQuery}
            total={totalConversations}
            activeSubTab={activeSubTab}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={toggleSidebar}
            onSelectConversation={(id, subTab = 'timeline') => {
              setIsSettingsOpen(false);
              if (currentView !== 'conversations') {
                setCurrentView('conversations');
              }
              if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
                setIsSidebarCollapsed(true);
              }
              if (id === selectedId) {
                setActiveSubTab(subTab);
              } else {
                selectConversation(id, subTab);
              }
            }}
            onSelectWorkspace={setSelectedWorkspace}
            onSearchChange={setSearchQuery}
            onNewSession={() => {
              setIsSettingsOpen(false);
              if (conversations.length > 0) {
                selectConversation(conversations[0].id, 'timeline');
              }
            }}
          />

          {/* Column 3: Central Execution Feed & Top Header */}
          <main className="hud-center-pane">
            {isSettingsOpen ? (
              <SettingsPage
                status={status}
                onClose={() => setIsSettingsOpen(false)}
                onUpdated={(newStatus) => {
                  setStatus(newStatus);
                  refreshData({ force: true });
                }}
                autoRefreshEnabled={autoRefreshEnabled}
                autoRefreshInterval={autoRefreshInterval}
                onToggleAutoRefresh={toggleAutoRefresh}
                onChangeInterval={changeAutoRefreshInterval}
                theme={theme}
                onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={toggleSidebar}
                isTelemetryOpen={isTelemetryOpen}
                onToggleTelemetry={() => setIsTelemetryOpen(prev => !prev)}
                activeSessionTitle={
                  session?.steps[0]?.userPrompt?.requestText
                    ? session.steps[0].userPrompt.requestText.slice(0, 48)
                    : session?.id || null
                }
              />
            ) : (
              <>
                <HudHeader
                  session={session}
                  workspaceName={currentWorkspaceName}
                  isSidebarCollapsed={isSidebarCollapsed}
                  onToggleSidebar={toggleSidebar}
                  isTelemetryOpen={isTelemetryOpen}
                  onToggleTelemetry={() => setIsTelemetryOpen(prev => !prev)}
                  onDeleteSession={() => setIsDeleteModalOpen(true)}
                  isRefreshing={isRefreshing}
                  onRefreshSession={() => refreshData({ force: true })}
                  autoRefreshEnabled={autoRefreshEnabled}
                  lastRefreshed={lastRefreshed}
                />

                <div className="hud-center-content-scroll">
                  {loadingSession ? (
                    <div className="hud-loading-state">
                      <Loader2 size={32} className="spin-icon" />
                      <p>Streaming conversation state & artifacts...</p>
                    </div>
                  ) : activeSubTab === 'artifacts' && session ? (
                    <div className="hud-subtab-container">
                      {artifacts ? (
                        <ArtifactsTab
                          conversationId={session.id}
                          artifacts={artifacts}
                          isRightPanelOpen={isTelemetryOpen}
                        />
                      ) : (
                        <div className="hud-loading-state">
                          <p>No artifacts available for this session.</p>
                        </div>
                      )}
                    </div>
                  ) : activeSubTab === 'db' && session ? (
                    <div className="hud-subtab-container">
                      {dbInfo ? (
                        <DatabaseTab
                          conversationId={session.id}
                          dbInfo={dbInfo}
                          isRightPanelOpen={isTelemetryOpen}
                        />
                      ) : (
                        <div className="hud-loading-state">
                          <p>No database available for this session.</p>
                        </div>
                      )}
                    </div>
                  ) : session ? (
                    <Timeline steps={session.steps} conversationId={session.id} focusedFile={focusedFile} />
                  ) : (
                    <div className="hud-no-selection-state">
                      <MessageSquare size={44} />
                      <p>Select a session from the list to inspect execution feed.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </main>

          {/* Column 4: Right Inspector & Telemetry Panel (Only for Conversation) */}
          {isTelemetryOpen && activeSubTab === 'timeline' && (
            <TelemetrySidebar
              session={session}
              selectedFile={focusedFile}
              onSelectFile={(filePath) => {
                setFocusedFile(filePath);
                if (activeSubTab !== 'timeline') {
                  setActiveSubTab('timeline');
                }
                if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
                  setIsTelemetryOpen(false);
                }
              }}
              onClose={() => setIsTelemetryOpen(false)}
            />
          )}
        </div>

      {/* Modals & Dialogs */}
      {selectedId && (
        <DeleteModal
          conversationId={selectedId}
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onDeleted={handleConversationDeleted}
        />
      )}



      <JitConsentModal />
    </div>
  );
};

export const App: React.FC = () => (
  <PermissionsProvider>
    <AppContent />
  </PermissionsProvider>
);
