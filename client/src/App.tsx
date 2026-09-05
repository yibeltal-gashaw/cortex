import React, { useState, useEffect } from 'react';
import { NavRail } from './components/NavRail.js';
import { Sidebar } from './components/Sidebar.js';
import { HudHeader } from './components/HudHeader.js';
import { Timeline } from './components/Timeline.js';
import { TelemetrySidebar } from './components/TelemetrySidebar.js';
import { ArtifactsTab } from './components/ArtifactsTab.js';
import { DatabaseTab } from './components/DatabaseTab.js';
import { DeleteModal } from './components/DeleteModal.js';
import { SettingsModal } from './components/SettingsModal.js';
import { PermissionsProvider } from './context/PermissionsContext.js';
import { SkillsPermissionsPage } from './components/SkillsPermissionsPage.js';
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
  const { currentView, setCurrentView, skills } = useAgentPermissions();
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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cortex_theme', theme);
  }, [theme]);

  // Load initial status and conversation list
  useEffect(() => {
    loadAppStatus();
    loadConversationList();
  }, [selectedWorkspace, searchQuery]);

  const loadAppStatus = async () => {
    try {
      const s = await fetchStatus();
      setStatus(s);
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  };

  const loadConversationList = async () => {
    try {
      const data = await fetchConversations({
        searchQuery,
        workspace: selectedWorkspace,
        limit: 150
      });
      setConversations(data.conversations);
      setTotalConversations(data.total);
      setWorkspaces(data.workspaces);

      // Auto-select first conversation if none selected
      if (!selectedId && data.conversations.length > 0) {
        selectConversation(data.conversations[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

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
      loadConversationList();
    }
  };

  const executingCount = Object.values(skills).filter((s) => s.status === 'executing').length;

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
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        status={status}
        executingCount={executingCount}
      />

      {/* 2. Main Multi-Pane Content */}
      {currentView === 'permissions' ? (
        <div className="cortex-hud-subview">
          <SkillsPermissionsPage />
        </div>
      ) : (
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
              if (conversations.length > 0) {
                selectConversation(conversations[0].id, 'timeline');
              }
            }}
          />

          {/* Column 3: Central Execution Feed & Top Header */}
          <main className="hud-center-pane">
            <HudHeader
              session={session}
              workspaceName={currentWorkspaceName}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={toggleSidebar}
              isTelemetryOpen={isTelemetryOpen}
              onToggleTelemetry={() => setIsTelemetryOpen(prev => !prev)}
              onDeleteSession={() => setIsDeleteModalOpen(true)}
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
      )}

      {/* Modals & Dialogs */}
      {selectedId && (
        <DeleteModal
          conversationId={selectedId}
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onDeleted={handleConversationDeleted}
        />
      )}

      <SettingsModal
        isOpen={isSettingsModalOpen}
        status={status}
        onClose={() => setIsSettingsModalOpen(false)}
        onUpdated={(newStatus) => {
          setStatus(newStatus);
          loadConversationList();
        }}
      />

      <JitConsentModal />
    </div>
  );
};

export const App: React.FC = () => (
  <PermissionsProvider>
    <AppContent />
  </PermissionsProvider>
);
