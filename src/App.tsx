import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Home,
  BookOpen,
  Waves,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  ChevronDown,
  Play,
  Pause,
  RotateCcw,
  Activity,
  Radio,
  Sliders,
  GitCompare,
  Sun,
  Moon,
  Search,
  X,
  Compass,
} from 'lucide-react';

import { SimulationProvider, useSimulation } from './context/SimulationContext';
import { LandingStudioView } from './views/studio/LandingStudioView';
import { OverviewStudioView, StudioBenchTopic } from './views/studio/OverviewStudioView';
import { ExperimentBenchView } from './views/studio/ExperimentBenchView';
import { ComparisonStudioView } from './views/studio/ComparisonStudioView';
import { TheoryStudioView } from './views/studio/TheoryStudioView';

type StudioRoute = 'landing' | 'overview' | 'bench' | 'comparison' | 'theory';

const BENCH_TOPICS: {
  id: StudioBenchTopic;
  num: string;
  label: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'conventional-am',
    num: '01',
    label: 'DSB-FC (AM)',
    keywords: 'conventional full carrier envelope modulation index',
    icon: Activity,
  },
  {
    id: 'dsb-sc',
    num: '02',
    label: 'DSB-SC & Costas',
    keywords: 'suppressed carrier ring coherent iq lock',
    icon: Radio,
  },
  {
    id: 'ssb',
    num: '03',
    label: 'SSB-SC',
    keywords: 'single sideband hilbert bpf filter usb lsb',
    icon: Waves,
  },
  {
    id: 'vsb',
    num: '04',
    label: 'VSB',
    keywords: 'vestigial sideband shaping filter symmetry',
    icon: Sliders,
  },
];

const TOPIC_DISPLAY: Record<StudioBenchTopic, string> = {
  'conventional-am': 'DSB-FC',
  'dsb-sc': 'DSB-SC',
  ssb: 'SSB-SC',
  vsb: 'VSB',
};

function AppContent() {
  const { isSimulating, toggleSimulation, simulationSpeed, setSimulationSpeed } = useSimulation();
  const [route, setRoute] = useState<StudioRoute>('landing');
  const [benchTopic, setBenchTopic] = useState<StudioBenchTopic>('conventional-am');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [labExpanded, setLabExpanded] = useState<boolean>(true);
  const [navQuery, setNavQuery] = useState<string>('');
  const [resetKey, setResetKey] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved =
        localStorage.getItem('ambox-dark-mode') ?? localStorage.getItem('modulab-dark-mode');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', darkMode && route !== 'landing');
    try {
      localStorage.setItem('ambox-dark-mode', String(darkMode));
    } catch {
      // ignore storage errors
    }
  }, [darkMode, route]);

  const handleOpenBenchTopic = (topic: StudioBenchTopic) => {
    setBenchTopic(topic);
    setRoute('bench');
  };

  const handleReset = () => {
    setResetKey((k) => k + 1);
  };

  const normalizedQuery = navQuery.trim().toLowerCase();

  const filteredBenchTopics = useMemo(() => {
    if (!normalizedQuery) return BENCH_TOPICS;
    return BENCH_TOPICS.filter(
      (item) =>
        item.label.toLowerCase().includes(normalizedQuery) ||
        item.num.includes(normalizedQuery) ||
        item.keywords.includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const showOverviewItem =
    !normalizedQuery ||
    'overview launchpad studio home'.includes(normalizedQuery);
  const showComparisonItem =
    !normalizedQuery ||
    'am comparison power bandwidth landscape compare'.includes(normalizedQuery);
  const showTheoryItem =
    !normalizedQuery ||
    'equations notes chapter 2 formulas theory'.includes(normalizedQuery);
  const showLabGroup =
    !normalizedQuery ||
    'modulation lab experiments bench'.includes(normalizedQuery) ||
    filteredBenchTopics.length > 0;

  const isLabSectionOpen = normalizedQuery ? filteredBenchTopics.length > 0 : labExpanded;

  if (route === 'landing') {
    return (
      <LandingStudioView
        onEnterBench={(topic) => {
          if (topic) setBenchTopic(topic);
          setRoute('bench');
        }}
        onOpenOverview={() => setRoute('overview')}
        onOpenComparison={() => setRoute('comparison')}
        onOpenTheory={() => setRoute('theory')}
      />
    );
  }

  return (
    <div className="min-h-screen lg:h-screen bg-[#F4F4F6] text-[#1D1D1F] flex font-nura lg:overflow-hidden lg:p-2 lg:gap-2">
      {/* Left Sidebar Matching Reference Architecture */}
      <aside
        className={`shrink-0 bg-[#F4F4F6] flex flex-col justify-between py-2.5 transition-all duration-200 z-40 select-none ${
          sidebarCollapsed ? 'w-14 items-center px-1.5' : 'w-60 px-2.5'
        }`}
      >
        <div className="space-y-3 w-full flex-1 min-h-0 overflow-y-auto pr-0.5">
          {/* Top Brand Row: Dark Icon Tile + AMBOX + Sidebar Toggle */}
          <div
            className={`flex items-center ${
              sidebarCollapsed ? 'justify-center' : 'justify-between px-1.5'
            }`}
          >
            <button
              type="button"
              onClick={() => setRoute('landing')}
              className={`flex items-center gap-2.5 text-[#1D1D1F] cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] rounded-lg ${
                sidebarCollapsed ? 'justify-center py-1' : 'px-1 py-0.5'
              }`}
              title="AMBOX Landing Page"
            >
              <svg
                viewBox="0 0 28 18"
                className="w-6 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 14 L8 4 L14 9 L20 14 L26 4" />
                <circle cx="14" cy="9" r="2" fill="#007AFF" stroke="none" />
              </svg>
              {!sidebarCollapsed && (
                <span className="text-[17px] font-bold tracking-tight whitespace-nowrap">
                  AMBOX
                </span>
              )}
            </button>

            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="p-1.5 rounded-md text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-black/[0.05] transition-colors cursor-pointer"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Bar */}
          {sidebarCollapsed ? (
            <button
              type="button"
              onClick={() => {
                setSidebarCollapsed(false);
                setTimeout(() => searchInputRef.current?.focus(), 60);
              }}
              className="w-full h-9 rounded-lg flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] transition-colors cursor-pointer"
              title="Search navigation"
              aria-label="Search navigation"
            >
              <Search className="w-4 h-4" />
            </button>
          ) : (
            <div className="relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-[#6E6E73] bg-black/[0.02] hover:bg-black/[0.04] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#D1D1D6] transition-all">
              <Search className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
                placeholder="Search"
                aria-label="Search AMBOX modules"
                className="w-full bg-transparent text-[13px] text-[#1D1D1F] placeholder:text-[#8E8E93] focus:outline-none min-w-0"
              />
              {navQuery && (
                <button
                  type="button"
                  onClick={() => setNavQuery('')}
                  className="text-[#8E8E93] hover:text-[#1D1D1F] cursor-pointer shrink-0"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Primary Navigation Tree */}
          <nav className="space-y-1 w-full" aria-label="AMBOX studio navigation">
            {showOverviewItem && (
              <button
                type="button"
                onClick={() => setRoute('overview')}
                title={sidebarCollapsed ? 'Overview' : undefined}
                className={`w-full flex items-center rounded-lg text-[13px] transition-colors cursor-pointer ${
                  sidebarCollapsed ? 'justify-center h-9 px-0' : 'gap-2.5 px-2.5 py-1.5 text-left'
                } ${
                  route === 'overview'
                    ? 'bg-[#E5E5EA] text-[#1D1D1F] font-semibold'
                    : 'text-[#52525B] hover:bg-black/[0.04] hover:text-[#1D1D1F] font-medium'
                }`}
              >
                <Home
                  className={`w-4 h-4 shrink-0 ${
                    route === 'overview' ? 'text-[#1D1D1F]' : 'text-[#6E6E73]'
                  }`}
                />
                {!sidebarCollapsed && <span className="truncate">Overview</span>}
              </button>
            )}

            {/* Expandable Modulation Lab Group with Vertical Tree Rail */}
            {showLabGroup && (
              <div className="space-y-0.5">
                {!sidebarCollapsed ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setLabExpanded((prev) => !prev)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer ${
                        route === 'bench'
                          ? 'text-[#1D1D1F] font-semibold hover:bg-black/[0.04]'
                          : 'text-[#52525B] hover:bg-black/[0.04] hover:text-[#1D1D1F] font-medium'
                      }`}
                      aria-expanded={isLabSectionOpen}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Activity
                          className={`w-4 h-4 shrink-0 ${
                            route === 'bench' ? 'text-[#1D1D1F]' : 'text-[#6E6E73]'
                          }`}
                        />
                        <span className="truncate">Modulation Lab</span>
                      </span>
                      {isLabSectionOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
                      )}
                    </button>

                    {isLabSectionOpen && filteredBenchTopics.length > 0 && (
                      <div className="relative ml-[17px] pl-3.5 border-l border-[#D1D1D6] space-y-0.5 py-0.5">
                        {filteredBenchTopics.map((item) => {
                          const isActive = route === 'bench' && benchTopic === item.id;
                          return (
                            <div key={item.id} className="relative">
                              <span
                                aria-hidden="true"
                                className={`absolute -left-[18.5px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-colors ${
                                  isActive ? 'bg-[#1D1D1F]' : 'bg-[#D1D1D6]'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => handleOpenBenchTopic(item.id)}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer text-left ${
                                  isActive
                                    ? 'bg-[#E5E5EA] text-[#1D1D1F] font-semibold'
                                    : 'text-[#52525B] hover:bg-black/[0.04] hover:text-[#1D1D1F] font-medium'
                                }`}
                              >
                                <span className="truncate">{item.label}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-1">
                    {filteredBenchTopics.map((item) => {
                      const Icon = item.icon;
                      const isActive = route === 'bench' && benchTopic === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleOpenBenchTopic(item.id)}
                          title={`${item.num}. ${item.label}`}
                          className={`w-full h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#E5E5EA] text-[#1D1D1F]'
                              : 'text-[#6E6E73] hover:bg-black/[0.04] hover:text-[#1D1D1F]'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Secondary Group Divider */}
            {(showComparisonItem || showTheoryItem) && (
              <div className="my-2 border-t border-[#E5E5EA]" />
            )}

            {showComparisonItem && (
              <button
                type="button"
                onClick={() => setRoute('comparison')}
                title={sidebarCollapsed ? 'AM Comparison' : undefined}
                className={`w-full flex items-center rounded-lg text-[13px] transition-colors cursor-pointer ${
                  sidebarCollapsed
                    ? 'justify-center h-9 px-0'
                    : 'justify-between gap-2 px-2.5 py-1.5 text-left'
                } ${
                  route === 'comparison'
                    ? 'bg-[#E5E5EA] text-[#1D1D1F] font-semibold'
                    : 'text-[#52525B] hover:bg-black/[0.04] hover:text-[#1D1D1F] font-medium'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <GitCompare
                    className={`w-4 h-4 shrink-0 ${
                      route === 'comparison' ? 'text-[#1D1D1F]' : 'text-[#6E6E73]'
                    }`}
                  />
                  {!sidebarCollapsed && <span className="truncate">AM Comparison</span>}
                </span>
                {!sidebarCollapsed && (
                  <ChevronRight className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
                )}
              </button>
            )}

            {showTheoryItem && (
              <button
                type="button"
                onClick={() => setRoute('theory')}
                title={sidebarCollapsed ? 'Equations & Notes' : undefined}
                className={`w-full flex items-center rounded-lg text-[13px] transition-colors cursor-pointer ${
                  sidebarCollapsed
                    ? 'justify-center h-9 px-0'
                    : 'justify-between gap-2 px-2.5 py-1.5 text-left'
                } ${
                  route === 'theory'
                    ? 'bg-[#E5E5EA] text-[#1D1D1F] font-semibold'
                    : 'text-[#52525B] hover:bg-black/[0.04] hover:text-[#1D1D1F] font-medium'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <BookOpen
                    className={`w-4 h-4 shrink-0 ${
                      route === 'theory' ? 'text-[#1D1D1F]' : 'text-[#6E6E73]'
                    }`}
                  />
                  {!sidebarCollapsed && <span className="truncate">Equations &amp; Notes</span>}
                </span>
                {!sidebarCollapsed && (
                  <ChevronRight className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
                )}
              </button>
            )}

            {normalizedQuery &&
              !showOverviewItem &&
              !showLabGroup &&
              !showComparisonItem &&
              !showTheoryItem && (
                <div className="px-2.5 py-3 text-xs text-[#8E8E93]">
                  No modules match "{navQuery}"
                </div>
              )}
          </nav>
        </div>

        {/* Bottom Sidebar Footer */}
        <div className="pt-3 border-t border-[#E5E5EA] w-full flex flex-col gap-1">
          {sidebarCollapsed ? (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="w-full h-9 rounded-lg flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] transition-colors cursor-pointer"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setRoute('landing')}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-[#52525B] hover:bg-black/[0.04] hover:text-[#1D1D1F] font-medium transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Compass className="w-4 h-4 text-[#6E6E73] shrink-0" />
                <span className="truncate">Landing Page</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content White Panel */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-white lg:rounded-2xl border border-[#E5E5EA] shadow-[0_1px_4px_rgba(0,0,0,0.03)] overflow-hidden">
        {/* Top Studio Breadcrumb & Speed Controls Bar */}
        <header className="h-12 shrink-0 bg-white border-b border-[#E5E5EA] px-4 md:px-6 flex items-center justify-between gap-4">
          {/* Left: Collapse/Expand Toggle + Breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="p-1.5 rounded-md text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F4F4F6] transition-colors cursor-pointer"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label="Toggle sidebar"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>

            <nav className="flex items-center gap-1.5 text-[13px] text-[#6E6E73] truncate">
              <button
                type="button"
                onClick={() => setRoute('overview')}
                className="hover:text-[#1D1D1F] cursor-pointer whitespace-nowrap"
              >
                AMBOX
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-[#AAAAAA] shrink-0" />
              {route === 'overview' && (
                <span className="font-semibold text-[#1D1D1F] whitespace-nowrap">Overview</span>
              )}
              {route === 'comparison' && (
                <span className="font-semibold text-[#1D1D1F] whitespace-nowrap">
                  AM Comparison
                </span>
              )}
              {route === 'theory' && (
                <span className="font-semibold text-[#1D1D1F] whitespace-nowrap">
                  Equations &amp; Notes
                </span>
              )}
              {route === 'bench' && (
                <>
                  <button
                    type="button"
                    onClick={() => setRoute('bench')}
                    className="hover:text-[#1D1D1F] cursor-pointer hidden sm:inline whitespace-nowrap"
                  >
                    Modulation Lab
                  </button>
                  <ChevronRight className="w-3.5 h-3.5 text-[#AAAAAA] shrink-0 hidden sm:inline" />
                  <span className="font-semibold text-[#1D1D1F] truncate">
                    {TOPIC_DISPLAY[benchTopic]}
                  </span>
                </>
              )}
            </nav>
          </div>

          {/* Right: Speed Selector (0.2x, 0.5x, 1x, 2x) + Pause/Play + Reset + Theme */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-[#F4F4F6] p-0.5 rounded-lg border border-[#E5E5EA] text-[11px] font-mono">
              {[0.2, 0.5, 1, 2].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setSimulationSpeed(spd)}
                  className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                    simulationSpeed === spd
                      ? 'bg-[#1D1D1F] text-white font-semibold'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                  title={`Simulation speed ${spd}x`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={toggleSimulation}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isSimulating
                  ? 'bg-[#F4F4F6] hover:bg-[#E5E5EA] text-[#1D1D1F] border border-[#E5E5EA]'
                  : 'bg-[#007AFF] hover:bg-[#0066D6] text-white'
              }`}
            >
              {isSimulating ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white border border-[#E5E5EA] text-[#52525B] hover:text-[#1D1D1F] hover:bg-[#F4F4F6] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Reset simulation parameters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white border border-[#E5E5EA] text-[#52525B] hover:text-[#1D1D1F] hover:bg-[#F4F4F6] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#007AFF]" />
                  <span className="hidden md:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Dark</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Active Studio View */}
        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          {route === 'overview' && (
            <OverviewStudioView
              onOpenExperiment={handleOpenBenchTopic}
              onOpenComparison={() => setRoute('comparison')}
            />
          )}

          {route === 'bench' && (
            <ExperimentBenchView
              activeTopic={benchTopic}
              onSelectTopic={setBenchTopic}
              resetKey={resetKey}
            />
          )}

          {route === 'comparison' && (
            <ComparisonStudioView onOpenExperiment={handleOpenBenchTopic} />
          )}

          {route === 'theory' && <TheoryStudioView onOpenExperiment={handleOpenBenchTopic} />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SimulationProvider>
      <AppContent />
    </SimulationProvider>
  );
}
