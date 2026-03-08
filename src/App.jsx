import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { supabase } from './lib/supabase';

const MODULES = [
  { name: 'Home', alwaysVisible: true, mobilePrimary: true },
  { name: 'Matches', mobilePrimary: true },
  { name: 'Roster' },
  { name: 'Players' },
  { name: 'Event Tracker', mobilePrimary: true },
  { name: 'Stat Sheet', mobilePrimary: true },
  { name: 'Analytics' },
  { name: 'Video', advanced: true },
  { name: 'Possession', advanced: true },
  { name: 'Help', alwaysVisible: true },
  { name: 'Privacy', alwaysVisible: true },
  { name: 'Changelog', alwaysVisible: true },
  { name: 'Settings', alwaysVisible: true }
];

const DEFAULT_SETTINGS = {
  quarterLength: 15,
  showStatTooltips: true,
  rememberLastModule: true,
  showHubTips: true,
  showAdvancedModules: false,
  showBackupReminder: true,
  lastBackupAt: '',
  defaultAnalysisScope: 'match',
  visibleModules: MODULES.reduce((acc, module) => {
    acc[module.name] = true;
    return acc;
  }, {})
};

const ACTION_GROUPS = [
  {
    key: 'attacking',
    title: 'Attacking',
    actions: [
      { key: 'goal', label: 'Goal', className: 'action-goal', tooltip: 'Open play goal.' },
      { key: 'assist', label: 'Assist', className: 'action-assist', tooltip: 'Final pass before a goal.' },
      { key: 'shot', label: 'Shot', className: 'action-shot', tooltip: 'Shot attempt that did not hit target.' },
      { key: 'shot_on_target', label: 'Shot On Target', className: 'action-shot-target', tooltip: 'Shot that would score without a save.' },
      { key: 'circle_entry', label: 'Circle Entry', className: 'action-circle', tooltip: 'Controlled circle entry.' },
      { key: 'pc_won', label: 'PC Won', className: 'action-pc', tooltip: 'Penalty corner won.' },
      { key: 'pc_goal', label: 'PC Goal', className: 'action-pc-goal', tooltip: 'Goal from penalty corner.' },
      { key: 'ps_won', label: 'PS Won', className: 'action-ps', tooltip: 'Penalty stroke won.' },
      { key: 'ps_scored', label: 'PS Scored', className: 'action-ps-goal', tooltip: 'Penalty stroke converted.' }
    ]
  },
  {
    key: 'defending',
    title: 'Defending',
    actions: [
      { key: 'save', label: 'Save', className: 'action-save', tooltip: 'Goalkeeper or defensive save.' },
      { key: 'interception', label: 'Interception', className: 'action-interception', tooltip: 'Intercepted pass/ball.' },
      { key: 'tackle_won', label: 'Tackle Won', className: 'action-tackle', tooltip: 'Successful tackle.' },
      { key: 'turnover_won', label: 'Turnover Won', className: 'action-turnover-won', tooltip: 'Regained possession from opponent.' },
      { key: 'turnover_lost', label: 'Turnover Lost', className: 'action-turnover-lost', tooltip: 'Lost possession.' },
      { key: 'pc_conceded', label: 'PC Conceded', className: 'action-pc-conceded', tooltip: 'Penalty corner conceded.' },
      { key: 'card_green', label: 'Green Card', className: 'action-card-green', tooltip: 'Green card.' },
      { key: 'card_yellow', label: 'Yellow Card', className: 'action-card-yellow', tooltip: 'Yellow card.' },
      { key: 'card_red', label: 'Red Card', className: 'action-card-red', tooltip: 'Red card.' }
    ]
  }
];

const STAT_TOOLTIPS = {
  goals: 'Goals scored (open play + PC goals + PS scored).',
  assists: 'Final pass that directly creates a goal.',
  shots_total: 'Total shots = shots + shots on target + goals.',
  shots_on_target_total: 'Shots on target, including goals.',
  shot_accuracy: 'Shots on target divided by total shots.',
  goal_conversion: 'Goals divided by total shots.',
  pc_won: 'Penalty corners won.',
  pc_goals: 'Goals scored from penalty corners.',
  pc_conversion: 'PC goals divided by PC won.',
  ps_conversion: 'PS scored divided by PS won.',
  circle_entries: 'Controlled entries into the attacking circle.',
  saves: 'Total saves.',
  interceptions: 'Total interceptions.',
  tackles_won: 'Total successful tackles.',
  turnover_balance: 'Turnovers won minus turnovers lost.',
  discipline: 'Weighted card score (green 1, yellow 2, red 4).',
  control_index: 'Proxy for control based on shot accuracy.',
  finishing_index: 'Proxy for finishing based on goal conversion.',
  transition_index: 'Transition impact based on turnover balance.',
  discipline_index: 'Score from discipline events (higher is better).'
};

const EMPTY_FORM = { name: '' };
const EMPTY_PLAYER_FORM = { name: '', number: '', position: '' };
const EMPTY_MATCH_FORM = { opponent: '', match_date: '' };
const EMPTY_REQUEST = { subject: 'Field Hockey Feature Request', message: '', submitting: false, error: '' };

const SETTINGS_KEY = 'fieldhockey_settings_v3';
const UI_KEY = 'fieldhockey_ui_state_v3';

function safeParse(value, fallback) {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function loadLocalSettings() {
  const parsed = safeParse(localStorage.getItem(SETTINGS_KEY), DEFAULT_SETTINGS);
  return {
    quarterLength: Number(parsed.quarterLength) || DEFAULT_SETTINGS.quarterLength,
    showStatTooltips:
      typeof parsed.showStatTooltips === 'boolean' ? parsed.showStatTooltips : DEFAULT_SETTINGS.showStatTooltips,
    rememberLastModule:
      typeof parsed.rememberLastModule === 'boolean' ? parsed.rememberLastModule : DEFAULT_SETTINGS.rememberLastModule,
    showHubTips: typeof parsed.showHubTips === 'boolean' ? parsed.showHubTips : DEFAULT_SETTINGS.showHubTips,
    showAdvancedModules:
      typeof parsed.showAdvancedModules === 'boolean'
        ? parsed.showAdvancedModules
        : DEFAULT_SETTINGS.showAdvancedModules,
    showBackupReminder:
      typeof parsed.showBackupReminder === 'boolean'
        ? parsed.showBackupReminder
        : DEFAULT_SETTINGS.showBackupReminder,
    lastBackupAt: typeof parsed.lastBackupAt === 'string' ? parsed.lastBackupAt : DEFAULT_SETTINGS.lastBackupAt,
    defaultAnalysisScope:
      parsed.defaultAnalysisScope === 'season' || parsed.defaultAnalysisScope === 'match'
        ? parsed.defaultAnalysisScope
        : DEFAULT_SETTINGS.defaultAnalysisScope,
    visibleModules: {
      ...DEFAULT_SETTINGS.visibleModules,
      ...(parsed.visibleModules || {})
    }
  };
}

const MODULE_COPY = {
  Home: 'Overview of the current workspace, quick access to modules, and operational guidance.',
  Matches: 'Create, edit, and manage the match list for the selected season and team.',
  Roster: 'Manage the shared team roster used across all field hockey modules.',
  Players: 'Review player report cards and compare output across selected data scope.',
  'Event Tracker': 'Track match events for your team with a fast, live-friendly workflow.',
  'Stat Sheet': 'Review match and season stat tables derived from scoring events.',
  Analytics: 'Review team KPIs, trends, and top contributors.',
  Video: 'Work with local video clips without uploading source footage.',
  Possession: 'Map possessions and passing sequences (advanced).',
  Help: 'Getting started, legends, and common workflow questions.',
  Privacy: 'Privacy and data handling information for this hub.',
  Changelog: 'Recent product updates, fixes, and module-level improvements.',
  Settings: 'Adjust visible modules, advanced analysis access, and workspace preferences.'
};

function loadUiState() {
  const parsed = safeParse(localStorage.getItem(UI_KEY), {});
  return {
    activeModule: parsed.activeModule || 'Home',
    selectedSeasonId: parsed.selectedSeasonId || '',
    selectedTeamId: parsed.selectedTeamId || '',
    selectedMatchId: parsed.selectedMatchId || '',
    analysisScope: parsed.analysisScope === 'season' ? 'season' : 'match',
    sidebarCollapsed: Boolean(parsed.sidebarCollapsed)
  };
}

function toPercentNumber(top, bottom) {
  if (!bottom) return 0;
  return Math.round((top / bottom) * 100);
}

function toCountMap(events) {
  return events.reduce((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1;
    return acc;
  }, {});
}

function parseClockToSeconds(clock, quarterLength) {
  const [rawMinutes, rawSeconds] = String(clock || '').split(':');
  const minutes = Number(rawMinutes);
  const seconds = Number(rawSeconds);
  const safeMinutes = Number.isFinite(minutes) ? minutes : quarterLength;
  const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
  return Math.max(0, Math.min(quarterLength * 60, safeMinutes * 60 + safeSeconds));
}

function formatSecondsAsClock(totalSeconds) {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function buildClockPresets(quarterLength) {
  const half = Math.max(1, Math.floor(quarterLength / 2));
  const values = [
    `${String(quarterLength).padStart(2, '0')}:00`,
    '10:00',
    `${String(half).padStart(2, '0')}:00`,
    '05:00',
    '02:00',
    '01:00',
    '00:30',
    '00:00'
  ];
  return values.filter((value, index) => values.indexOf(value) === index);
}

function splitClock(value) {
  const [rawMinutes, rawSeconds] = String(value || '').split(':');
  return {
    minutes: /^\d{1,2}$/.test(rawMinutes || '') ? rawMinutes.padStart(2, '0') : '00',
    seconds: /^\d{1,2}$/.test(rawSeconds || '') ? rawSeconds.padStart(2, '0') : '00'
  };
}

function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function toCsvCell(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function splitCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  out.push(current);
  return out;
}

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replaceAll(' ', '_')
    .replaceAll('-', '_');
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function computeStatsFromEvents(matchEvents) {
  const counts = toCountMap(matchEvents);
  const goals = (counts.goal || 0) + (counts.pc_goal || 0) + (counts.ps_scored || 0);
  const shotsOffTarget = counts.shot || 0;
  const shotsOnTargetNoGoal = counts.shot_on_target || 0;
  const shotsTotal = shotsOffTarget + shotsOnTargetNoGoal + goals;
  const shotsOnTargetTotal = shotsOnTargetNoGoal + goals;
  const pcWon = counts.pc_won || 0;
  const pcGoals = counts.pc_goal || 0;
  const psWon = counts.ps_won || 0;
  const psScored = counts.ps_scored || 0;
  const turnoverWon = counts.turnover_won || 0;
  const turnoverLost = counts.turnover_lost || 0;
  const greenCards = counts.card_green || 0;
  const yellowCards = counts.card_yellow || 0;
  const redCards = counts.card_red || 0;
  const discipline = greenCards + yellowCards * 2 + redCards * 4;

  return {
    goals,
    assists: counts.assist || 0,
    shotsTotal,
    shotsOnTargetTotal,
    shotAccuracy: toPercentNumber(shotsOnTargetTotal, shotsTotal),
    goalConversion: toPercentNumber(goals, shotsTotal),
    pcWon,
    pcGoals,
    pcConversion: toPercentNumber(pcGoals, pcWon),
    psWon,
    psScored,
    psConversion: toPercentNumber(psScored, psWon),
    circleEntries: counts.circle_entry || 0,
    saves: counts.save || 0,
    interceptions: counts.interception || 0,
    tacklesWon: counts.tackle_won || 0,
    turnoverWon,
    turnoverLost,
    turnoverBalance: turnoverWon - turnoverLost,
    greenCards,
    yellowCards,
    redCards,
    discipline,
    controlIndex: toPercentNumber(shotsOnTargetTotal, shotsTotal),
    finishingIndex: toPercentNumber(goals, shotsTotal),
    transitionIndex: turnoverWon - turnoverLost,
    disciplineIndex: Math.max(0, 100 - discipline * 8)
  };
}

function buildGeneratedRows(matches, events) {
  return matches.map((match) => {
    const matchEvents = events.filter((event) => event.match_id === match.id);
    return {
      rowId: `generated_${match.id}`,
      source: 'generated',
      matchId: match.id,
      opponent: match.opponent,
      matchDate: match.match_date || '',
      ...computeStatsFromEvents(matchEvents)
    };
  });
}

function buildPlayerMatchRows(matches, players, events, scope, selectedMatchId) {
  const matchMap = new Map(matches.map((match) => [match.id, match]));
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const scopedMatchId = scope === 'match' ? selectedMatchId : '';
  const groups = new Map();

  events.forEach((event) => {
    if (!event.match_id || !event.player_id) return;
    if (scopedMatchId && event.match_id !== scopedMatchId) return;
    const key = `${event.match_id}__${event.player_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  });

  return Array.from(groups.entries())
    .map(([key, groupEvents]) => {
      const [matchId, playerId] = key.split('__');
      const match = matchMap.get(matchId);
      const player = playerMap.get(playerId);
      const stats = computeStatsFromEvents(groupEvents);
      return {
        rowId: `pm_${key}`,
        matchId,
        matchDate: match?.match_date || '',
        opponent: match?.opponent || 'Unknown match',
        playerId,
        playerName: player?.name || 'Unknown player',
        playerNumber: player?.number ?? null,
        eventCount: groupEvents.length,
        ...stats
      };
    })
    .sort((a, b) => {
      if (!a.matchDate && !b.matchDate) {
        if ((a.playerNumber ?? 999) !== (b.playerNumber ?? 999)) return (a.playerNumber ?? 999) - (b.playerNumber ?? 999);
        return a.playerName.localeCompare(b.playerName);
      }
      if (!a.matchDate) return 1;
      if (!b.matchDate) return -1;
      const byDate = b.matchDate.localeCompare(a.matchDate);
      if (byDate !== 0) return byDate;
      if ((a.playerNumber ?? 999) !== (b.playerNumber ?? 999)) return (a.playerNumber ?? 999) - (b.playerNumber ?? 999);
      return a.playerName.localeCompare(b.playerName);
    });
}

function buildSummary(rows) {
  if (!rows.length) {
    return {
      matches: 0,
      goals: 0,
      shotsTotal: 0,
      shotsOnTargetTotal: 0,
      shotAccuracy: 0,
      pcWon: 0,
      pcGoals: 0,
      pcConversion: 0,
      turnoverBalance: 0,
      discipline: 0,
      controlIndex: 0,
      finishingIndex: 0,
      transitionIndex: 0,
      disciplineIndex: 0
    };
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.matches += 1;
      acc.goals += row.goals || 0;
      acc.shotsTotal += row.shotsTotal || 0;
      acc.shotsOnTargetTotal += row.shotsOnTargetTotal || 0;
      acc.pcWon += row.pcWon || 0;
      acc.pcGoals += row.pcGoals || 0;
      acc.turnoverBalance += row.turnoverBalance || 0;
      acc.discipline += row.discipline || 0;
      acc.controlIndex += row.controlIndex || 0;
      acc.finishingIndex += row.finishingIndex || 0;
      acc.transitionIndex += row.transitionIndex || 0;
      acc.disciplineIndex += row.disciplineIndex || 0;
      return acc;
    },
    {
      matches: 0,
      goals: 0,
      shotsTotal: 0,
      shotsOnTargetTotal: 0,
      pcWon: 0,
      pcGoals: 0,
      turnoverBalance: 0,
      discipline: 0,
      controlIndex: 0,
      finishingIndex: 0,
      transitionIndex: 0,
      disciplineIndex: 0
    }
  );

  return {
    ...totals,
    shotAccuracy: toPercentNumber(totals.shotsOnTargetTotal, totals.shotsTotal),
    pcConversion: toPercentNumber(totals.pcGoals, totals.pcWon),
    controlIndex: Math.round(totals.controlIndex / totals.matches),
    finishingIndex: Math.round(totals.finishingIndex / totals.matches),
    transitionIndex: Math.round(totals.transitionIndex / totals.matches),
    disciplineIndex: Math.round(totals.disciplineIndex / totals.matches)
  };
}

function parseStatSheetCsv(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return {
      rows: [],
      accepted: 0,
      total: 0,
      skipped: [{ line: 0, reason: 'File is empty.' }]
    };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const rows = [];
  const skipped = [];

  const readValue = (record, keys) => {
    for (const key of keys) {
      if (record[key] !== undefined) return record[key];
    }
    return '';
  };

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = splitCsvLine(lines[lineIndex]);
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });

    const opponent = readValue(record, ['opponent', 'match', 'match_name']).trim();
    if (!opponent) {
      skipped.push({ line: lineIndex + 1, reason: 'Missing opponent/match column.' });
      continue;
    }

    rows.push({
      rowId: `imported_${Date.now()}_${lineIndex}`,
      source: 'imported',
      matchId: '',
      opponent,
      matchDate: readValue(record, ['match_date', 'date']) || '',
      goals: parseNumber(readValue(record, ['goals'])) ?? null,
      assists: parseNumber(readValue(record, ['assists'])) ?? null,
      shotsTotal: parseNumber(readValue(record, ['shots_total', 'shots'])) ?? null,
      shotsOnTargetTotal: parseNumber(readValue(record, ['shots_on_target_total', 'shots_on_target', 'sot'])) ?? null,
      shotAccuracy: parseNumber(readValue(record, ['shot_accuracy'])) ?? null,
      goalConversion: parseNumber(readValue(record, ['goal_conversion'])) ?? null,
      pcWon: parseNumber(readValue(record, ['pc_won'])) ?? null,
      pcGoals: parseNumber(readValue(record, ['pc_goals', 'pc_goal'])) ?? null,
      pcConversion: parseNumber(readValue(record, ['pc_conversion'])) ?? null,
      psWon: parseNumber(readValue(record, ['ps_won'])) ?? null,
      psScored: parseNumber(readValue(record, ['ps_scored'])) ?? null,
      psConversion: parseNumber(readValue(record, ['ps_conversion'])) ?? null,
      circleEntries: parseNumber(readValue(record, ['circle_entries'])) ?? null,
      saves: parseNumber(readValue(record, ['saves'])) ?? null,
      interceptions: parseNumber(readValue(record, ['interceptions'])) ?? null,
      tacklesWon: parseNumber(readValue(record, ['tackles_won'])) ?? null,
      turnoverWon: parseNumber(readValue(record, ['turnover_won'])) ?? null,
      turnoverLost: parseNumber(readValue(record, ['turnover_lost'])) ?? null,
      turnoverBalance: parseNumber(readValue(record, ['turnover_balance'])) ?? null,
      greenCards: parseNumber(readValue(record, ['green_cards'])) ?? null,
      yellowCards: parseNumber(readValue(record, ['yellow_cards'])) ?? null,
      redCards: parseNumber(readValue(record, ['red_cards'])) ?? null,
      discipline: parseNumber(readValue(record, ['discipline'])) ?? null,
      controlIndex: parseNumber(readValue(record, ['control_index'])) ?? null,
      finishingIndex: parseNumber(readValue(record, ['finishing_index'])) ?? null,
      transitionIndex: parseNumber(readValue(record, ['transition_index'])) ?? null,
      disciplineIndex: parseNumber(readValue(record, ['discipline_index'])) ?? null
    });
  }

  return {
    rows,
    accepted: rows.length,
    total: Math.max(0, lines.length - 1),
    skipped
  };
}

const StatLabel = ({ label, tooltip, enabled }) => {
  if (!enabled || !tooltip) return <span>{label}</span>;
  return (
    <span className="stat-label" tabIndex={0}>
      {label}
      <span className="stat-info" aria-hidden="true">
        i
      </span>
      <span role="tooltip" className="stat-tooltip">
        {tooltip}
      </span>
    </span>
  );
};

function App() {
  const initialUiState = loadUiState();
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [email, setEmail] = useState('');

  const [settings, setSettings] = useState(loadLocalSettings);
  const [activeModule, setActiveModule] = useState(initialUiState.activeModule);
  const [analysisScope, setAnalysisScope] = useState(initialUiState.analysisScope || 'match');
  const [status, setStatus] = useState('');

  const [seasons, setSeasons] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [events, setEvents] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedSeasonId, setSelectedSeasonId] = useState(initialUiState.selectedSeasonId);
  const [selectedTeamId, setSelectedTeamId] = useState(initialUiState.selectedTeamId);
  const [selectedMatchId, setSelectedMatchId] = useState(initialUiState.selectedMatchId);
  const [restoringWorkspace, setRestoringWorkspace] = useState(
    Boolean(initialUiState.selectedSeasonId || initialUiState.selectedTeamId)
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(Boolean(initialUiState.sidebarCollapsed));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [seasonForm, setSeasonForm] = useState(EMPTY_FORM);
  const [teamForm, setTeamForm] = useState(EMPTY_FORM);
  const [playerForm, setPlayerForm] = useState(EMPTY_PLAYER_FORM);
  const [matchForm, setMatchForm] = useState(EMPTY_MATCH_FORM);

  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState('');
  const [editingPlayerForm, setEditingPlayerForm] = useState(EMPTY_PLAYER_FORM);
  const [reportPlayerId, setReportPlayerId] = useState('');
  const [featureDialog, setFeatureDialog] = useState(null);
  const [period, setPeriod] = useState(1);
  const [clock, setClock] = useState(`${String(DEFAULT_SETTINGS.quarterLength).padStart(2, '0')}:00`);
  const [activeActionGroupKey, setActiveActionGroupKey] = useState(ACTION_GROUPS[0].key);

  const [importReport, setImportReport] = useState(null);
  const [importedRows, setImportedRows] = useState([]);
  const [statSheetSource, setStatSheetSource] = useState('all');

  const [videoUrl, setVideoUrl] = useState('');
  const [videoName, setVideoName] = useState('');
  const videoRef = useRef(null);

  const hiddenImportInputRef = useRef(null);

  const selectedSeason = useMemo(() => seasons.find((season) => season.id === selectedSeasonId) || null, [seasons, selectedSeasonId]);
  const selectedTeam = useMemo(() => teams.find((team) => team.id === selectedTeamId) || null, [teams, selectedTeamId]);

  const visibleModules = useMemo(() => {
    return MODULES.filter((module) => {
      if (module.advanced && !settings.showAdvancedModules) return false;
      return module.alwaysVisible || settings.visibleModules[module.name] !== false;
    }).map((module) => module.name);
  }, [settings.showAdvancedModules, settings.visibleModules]);

  const mobilePrimaryModules = useMemo(
    () => visibleModules.filter((name) => MODULES.find((module) => module.name === name)?.mobilePrimary),
    [visibleModules]
  );
  const mobileOverflowModules = useMemo(
    () => visibleModules.filter((name) => !mobilePrimaryModules.includes(name)),
    [mobilePrimaryModules, visibleModules]
  );

  const minuteOptions = useMemo(
    () =>
      Array.from({ length: settings.quarterLength + 1 }, (_, index) => String(settings.quarterLength - index).padStart(2, '0')),
    [settings.quarterLength]
  );
  const secondOptions = useMemo(() => Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')), []);
  const clockPresets = useMemo(() => buildClockPresets(settings.quarterLength), [settings.quarterLength]);
  const clockParts = useMemo(() => splitClock(clock), [clock]);

  const statTooltip = useCallback(
    (key) => {
      if (!settings.showStatTooltips) return '';
      return STAT_TOOLTIPS[key] || '';
    },
    [settings.showStatTooltips]
  );

  const analysisEvents = useMemo(() => {
    if (analysisScope === 'match' && selectedMatchId) {
      return events.filter((event) => event.match_id === selectedMatchId);
    }
    return events;
  }, [analysisScope, selectedMatchId, events]);

  const generatedStatRows = useMemo(() => buildGeneratedRows(matches, events), [matches, events]);
  const playerMatchRows = useMemo(
    () => buildPlayerMatchRows(matches, players, events, analysisScope, selectedMatchId),
    [analysisScope, events, matches, players, selectedMatchId]
  );
  const playerMatchSummary = useMemo(() => buildSummary(playerMatchRows), [playerMatchRows]);
  const statRows = useMemo(() => {
    if (statSheetSource === 'generated') return generatedStatRows;
    if (statSheetSource === 'imported') return importedRows;
    return [...generatedStatRows, ...importedRows];
  }, [generatedStatRows, importedRows, statSheetSource]);

  const statSummary = useMemo(() => buildSummary(statRows), [statRows]);
  const analyticsSummary = useMemo(() => computeStatsFromEvents(analysisEvents), [analysisEvents]);

  const matchRows = useMemo(() => {
    return [...generatedStatRows].sort((a, b) => {
      if (!a.matchDate && !b.matchDate) return a.opponent.localeCompare(b.opponent);
      if (!a.matchDate) return 1;
      if (!b.matchDate) return -1;
      return b.matchDate.localeCompare(a.matchDate);
    });
  }, [generatedStatRows]);

  const topPlayers = useMemo(() => {
    const byPlayer = {};
    for (const event of analysisEvents) {
      if (!event.player_id) continue;
      if (!byPlayer[event.player_id]) {
        byPlayer[event.player_id] = { playerId: event.player_id, goals: 0, assists: 0, shots: 0, cards: 0 };
      }
      if (event.event_type === 'goal' || event.event_type === 'pc_goal' || event.event_type === 'ps_scored') byPlayer[event.player_id].goals += 1;
      if (event.event_type === 'assist') byPlayer[event.player_id].assists += 1;
      if (event.event_type === 'shot' || event.event_type === 'shot_on_target') byPlayer[event.player_id].shots += 1;
      if (['card_green', 'card_yellow', 'card_red'].includes(event.event_type)) byPlayer[event.player_id].cards += 1;
    }

    return Object.values(byPlayer)
      .map((entry) => ({ ...entry, player: players.find((player) => player.id === entry.playerId) }))
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.shots - a.shots)
      .slice(0, 10);
  }, [analysisEvents, players]);

  const playerReport = useMemo(() => {
    if (!reportPlayerId) return null;
    const player = players.find((entry) => entry.id === reportPlayerId);
    if (!player) return null;

    const playerEvents = analysisEvents.filter((event) => event.player_id === reportPlayerId);
    const stats = computeStatsFromEvents(playerEvents);

    return {
      player,
      events: playerEvents.length,
      ...stats,
      contributions: stats.goals + stats.assists
    };
  }, [reportPlayerId, players, analysisEvents]);

  const selectedMatchEvents = useMemo(() => {
    if (!selectedMatchId) return [];
    return events.filter((event) => event.match_id === selectedMatchId);
  }, [events, selectedMatchId]);

  const backupReminderDue = useMemo(() => {
    if (!settings.showBackupReminder) return false;
    if (!settings.lastBackupAt) return true;
    const last = new Date(settings.lastBackupAt);
    if (Number.isNaN(last.getTime())) return true;
    const diffDays = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 7;
  }, [settings.lastBackupAt, settings.showBackupReminder]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(
      UI_KEY,
      JSON.stringify({
        activeModule: settings.rememberLastModule ? activeModule : 'Home',
        selectedSeasonId,
        selectedTeamId,
        selectedMatchId,
        analysisScope,
        sidebarCollapsed
      })
    );
  }, [activeModule, analysisScope, selectedMatchId, selectedSeasonId, selectedTeamId, settings.rememberLastModule, sidebarCollapsed]);

  useEffect(() => {
    if (!visibleModules.includes(activeModule)) {
      setActiveModule('Home');
    }
  }, [activeModule, visibleModules]);

  useEffect(() => {
    if (settings.defaultAnalysisScope !== analysisScope && !session?.user?.id) {
      setAnalysisScope(settings.defaultAnalysisScope);
    }
  }, [analysisScope, session?.user?.id, settings.defaultAnalysisScope]);

  useEffect(() => {
    if (!clock || Number(clock.split(':')[0]) > settings.quarterLength) {
      setClock(`${String(settings.quarterLength).padStart(2, '0')}:00`);
    }
  }, [clock, settings.quarterLength]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    if (!session?.user?.id) {
      setSeasons([]);
      setTeams([]);
      setPlayers([]);
      setMatches([]);
      setEvents([]);
      setSelectedSeasonId('');
      setSelectedTeamId('');
      setSelectedMatchId('');
      setRestoringWorkspace(false);
      return;
    }
    loadSeasons(session.user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || !selectedSeasonId) {
      setTeams([]);
      setSelectedTeamId('');
      setRestoringWorkspace(false);
      return;
    }
    loadTeams(session.user.id, selectedSeasonId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, selectedSeasonId]);

  useEffect(() => {
    if (!session?.user?.id || !selectedTeamId) {
      setPlayers([]);
      setMatches([]);
      setEvents([]);
      setSelectedMatchId('');
      return;
    }
    loadTeamResources(session.user.id, selectedTeamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, selectedTeamId]);

  useEffect(() => {
    if (selectedMatchId && !matches.some((match) => match.id === selectedMatchId)) {
      setSelectedMatchId(matches[0]?.id || '');
    }
  }, [selectedMatchId, matches]);

  useEffect(() => {
    if (!reportPlayerId || !players.find((player) => player.id === reportPlayerId)) {
      setReportPlayerId(players[0]?.id || '');
    }
  }, [players, reportPlayerId]);

  useEffect(() => {
    if (!selectedTeamId) {
      setImportedRows([]);
      setImportReport(null);
      return;
    }
    const parsed = safeParse(localStorage.getItem(`fieldhockey_statsheet_import_${selectedTeamId}`), []);
    setImportedRows(Array.isArray(parsed) ? parsed : []);
    setImportReport(null);
  }, [selectedTeamId]);

  useEffect(() => {
    if (!selectedTeamId) return;
    localStorage.setItem(`fieldhockey_statsheet_import_${selectedTeamId}`, JSON.stringify(importedRows));
  }, [importedRows, selectedTeamId]);

  async function loadSeasons(userId) {
    setLoadingData(true);
    setStatus('Loading seasons...');

    const { data, error } = await supabase.from('seasons').select('*').eq('user_id', userId).order('created_at', { ascending: false });

    if (error) {
      setStatus(`Failed to load seasons: ${error.message}`);
      setRestoringWorkspace(false);
      setLoadingData(false);
      return;
    }

    const seasonRows = data || [];
    setSeasons(seasonRows);

    const hasSeason = seasonRows.some((season) => season.id === selectedSeasonId);
    const seasonId = hasSeason ? selectedSeasonId : seasonRows[0]?.id || '';
    if (!hasSeason) setSelectedSeasonId(seasonId);
    if (!seasonId) setRestoringWorkspace(false);

    setStatus('');
    setLoadingData(false);
  }

  async function loadTeams(userId, seasonId) {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('user_id', userId)
      .eq('season_id', seasonId)
      .order('created_at', { ascending: false });

    if (error) {
      setStatus(`Failed to load teams: ${error.message}`);
      setRestoringWorkspace(false);
      return;
    }

    const teamRows = data || [];
    setTeams(teamRows);

    const hasTeam = teamRows.some((team) => team.id === selectedTeamId);
    if (!hasTeam) setSelectedTeamId(teamRows[0]?.id || '');
    setRestoringWorkspace(false);
  }

  async function loadTeamResources(userId, teamId) {
    setLoadingData(true);
    setStatus('Loading team data...');

    const [playersResult, matchesResult] = await Promise.all([
      supabase.from('players').select('*').eq('user_id', userId).eq('team_id', teamId).order('number', { ascending: true }),
      supabase.from('matches').select('*').eq('user_id', userId).eq('team_id', teamId).order('match_date', { ascending: false })
    ]);

    if (playersResult.error || matchesResult.error) {
      const message = playersResult.error?.message || matchesResult.error?.message || 'Unknown error';
      setStatus(`Failed to load team resources: ${message}`);
      setLoadingData(false);
      return;
    }

    const playerRows = playersResult.data || [];
    const matchRows = (matchesResult.data || []).sort((a, b) => {
      if (!a.match_date && !b.match_date) return 0;
      if (!a.match_date) return 1;
      if (!b.match_date) return -1;
      return b.match_date.localeCompare(a.match_date);
    });

    setPlayers(playerRows);
    setMatches(matchRows);

    const matchIds = matchRows.map((match) => match.id);
    if (!matchIds.length) {
      setEvents([]);
      setSelectedMatchId('');
      setStatus('');
      setLoadingData(false);
      return;
    }

    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .in('match_id', matchIds)
      .order('created_at', { ascending: false });

    if (eventsError) {
      setStatus(`Failed to load events: ${eventsError.message}`);
      setLoadingData(false);
      return;
    }

    setEvents(eventsData || []);
    if (!selectedMatchId || !matchRows.some((match) => match.id === selectedMatchId)) {
      setSelectedMatchId(matchRows[0]?.id || '');
    }

    setStatus('');
    setLoadingData(false);
  }

  async function sendMagicLink(event) {
    event.preventDefault();
    if (!email.trim()) {
      setStatus('Enter an email address first.');
      return;
    }

    setAuthBusy(true);
    setStatus('Sending magic link...');

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin }
    });

    setAuthBusy(false);
    if (error) {
      setStatus(`Login failed: ${error.message}`);
      return;
    }

    setStatus('Magic link sent. Check your inbox (and spam).');
  }

  async function signOut() {
    await supabase.auth.signOut();
    setStatus('Signed out.');
  }

  async function submitFeatureRequest() {
    if (!featureDialog || !session?.user?.id) return;
    const subject = featureDialog.subject.trim();
    const message = featureDialog.message.trim();
    if (!subject || !message) {
      setFeatureDialog((prev) => (prev ? { ...prev, error: 'Please enter both subject and message.' } : prev));
      return;
    }

    setFeatureDialog((prev) => (prev ? { ...prev, submitting: true, error: '' } : prev));

    const { error } = await supabase.from('feature_requests').insert({
      user_id: session.user.id,
      season_id: selectedSeasonId || null,
      team_id: selectedTeamId || null,
      app_name: 'fieldhockey',
      subject,
      message,
      status: 'new'
    });

    if (error) {
      setFeatureDialog((prev) => (prev ? { ...prev, submitting: false, error: `Could not submit request: ${error.message}` } : prev));
      return;
    }

    setFeatureDialog(null);
    setStatus('Feature request submitted. You can also email info@paulzuiderduin.com.');
  }

  async function createSeason(event) {
    event.preventDefault();
    if (!seasonForm.name.trim() || !session?.user?.id) return;
    const { error } = await supabase.from('seasons').insert({ user_id: session.user.id, name: seasonForm.name.trim() });
    if (error) {
      setStatus(`Failed to create season: ${error.message}`);
      return;
    }
    setSeasonForm(EMPTY_FORM);
    await loadSeasons(session.user.id);
  }

  async function renameSeason(season) {
    if (!session?.user?.id) return;
    const nextName = window.prompt('Rename season', season.name);
    if (!nextName?.trim()) return;
    const { error } = await supabase.from('seasons').update({ name: nextName.trim() }).eq('id', season.id).eq('user_id', session.user.id);
    if (error) {
      setStatus(`Failed to rename season: ${error.message}`);
      return;
    }
    await loadSeasons(session.user.id);
  }

  async function deleteSeason(seasonId) {
    if (!session?.user?.id) return;
    if (!window.confirm('Delete this season and all linked data?')) return;
    const { error } = await supabase.from('seasons').delete().eq('id', seasonId).eq('user_id', session.user.id);
    if (error) {
      setStatus(`Failed to delete season: ${error.message}`);
      return;
    }
    await loadSeasons(session.user.id);
  }

  async function createTeam(event) {
    event.preventDefault();
    if (!teamForm.name.trim() || !session?.user?.id || !selectedSeasonId) return;
    const { error } = await supabase.from('teams').insert({ user_id: session.user.id, season_id: selectedSeasonId, name: teamForm.name.trim() });
    if (error) {
      setStatus(`Failed to create team: ${error.message}`);
      return;
    }
    setTeamForm(EMPTY_FORM);
    await loadTeams(session.user.id, selectedSeasonId);
  }

  async function renameTeam(team) {
    if (!session?.user?.id) return;
    const nextName = window.prompt('Rename team', team.name);
    if (!nextName?.trim()) return;
    const { error } = await supabase.from('teams').update({ name: nextName.trim() }).eq('id', team.id).eq('user_id', session.user.id);
    if (error) {
      setStatus(`Failed to rename team: ${error.message}`);
      return;
    }
    await loadTeams(session.user.id, selectedSeasonId);
  }

  async function deleteTeam(teamId) {
    if (!session?.user?.id) return;
    if (!window.confirm('Delete this team and all linked data?')) return;
    const { error } = await supabase.from('teams').delete().eq('id', teamId).eq('user_id', session.user.id);
    if (error) {
      setStatus(`Failed to delete team: ${error.message}`);
      return;
    }
    await loadTeams(session.user.id, selectedSeasonId);
  }

  async function createPlayer(event) {
    event.preventDefault();
    if (!playerForm.name.trim() || !selectedTeamId || !session?.user?.id) return;

    const payload = {
      user_id: session.user.id,
      team_id: selectedTeamId,
      name: playerForm.name.trim(),
      number: playerForm.number ? Number(playerForm.number) : null,
      position: playerForm.position.trim() || null
    };

    const { error } = await supabase.from('players').insert(payload);
    if (error) {
      setStatus(`Failed to create player: ${error.message}`);
      return;
    }

    setPlayerForm(EMPTY_PLAYER_FORM);
    await loadTeamResources(session.user.id, selectedTeamId);
  }

  function startEditPlayer(player) {
    setEditingPlayerId(player.id);
    setEditingPlayerForm({
      name: player.name || '',
      number: player.number?.toString() || '',
      position: player.position || ''
    });
  }

  function cancelEditPlayer() {
    setEditingPlayerId('');
    setEditingPlayerForm(EMPTY_PLAYER_FORM);
  }

  async function savePlayer(playerId) {
    if (!session?.user?.id || !selectedTeamId) return;
    if (!editingPlayerForm.name.trim()) {
      setStatus('Player name is required.');
      return;
    }

    const { error } = await supabase
      .from('players')
      .update({
        name: editingPlayerForm.name.trim(),
        number: editingPlayerForm.number ? Number(editingPlayerForm.number) : null,
        position: editingPlayerForm.position.trim() || null
      })
      .eq('id', playerId)
      .eq('user_id', session.user.id);

    if (error) {
      setStatus(`Failed to update player: ${error.message}`);
      return;
    }

    cancelEditPlayer();
    await loadTeamResources(session.user.id, selectedTeamId);
  }

  async function deletePlayer(playerId) {
    if (!session?.user?.id || !selectedTeamId) return;
    const { error } = await supabase.from('players').delete().eq('id', playerId).eq('user_id', session.user.id);
    if (error) {
      setStatus(`Failed to delete player: ${error.message}`);
      return;
    }

    if (reportPlayerId === playerId) setReportPlayerId('');
    if (selectedPlayerId === playerId) setSelectedPlayerId('');
    if (editingPlayerId === playerId) cancelEditPlayer();

    await loadTeamResources(session.user.id, selectedTeamId);
  }

  async function createMatch(event) {
    event.preventDefault();
    if (!matchForm.opponent.trim() || !session?.user?.id || !selectedTeamId) return;

    const { error } = await supabase.from('matches').insert({
      user_id: session.user.id,
      team_id: selectedTeamId,
      opponent: matchForm.opponent.trim(),
      match_date: matchForm.match_date || null
    });

    if (error) {
      setStatus(`Failed to create match: ${error.message}`);
      return;
    }

    setMatchForm(EMPTY_MATCH_FORM);
    await loadTeamResources(session.user.id, selectedTeamId);
  }

  async function deleteMatch(matchId) {
    if (!session?.user?.id || !selectedTeamId) return;
    const { error } = await supabase.from('matches').delete().eq('id', matchId).eq('user_id', session.user.id);
    if (error) {
      setStatus(`Failed to delete match: ${error.message}`);
      return;
    }
    await loadTeamResources(session.user.id, selectedTeamId);
  }

  async function addEvent(actionKey) {
    if (!session?.user?.id || !selectedTeamId) {
      setStatus('Select season and team first.');
      return;
    }
    if (!selectedMatchId) {
      setStatus('Select a match before logging events.');
      return;
    }

    const { error } = await supabase.from('events').insert({
      user_id: session.user.id,
      match_id: selectedMatchId,
      player_id: selectedPlayerId || null,
      event_type: actionKey,
      period,
      time_left: clock
    });

    if (error) {
      setStatus(`Failed to add event: ${error.message}`);
      return;
    }

    await loadTeamResources(session.user.id, selectedTeamId);
  }

  async function deleteEvent(eventId) {
    if (!session?.user?.id || !selectedTeamId) return;
    const { error } = await supabase.from('events').delete().eq('id', eventId).eq('user_id', session.user.id);
    if (error) {
      setStatus(`Failed to delete event: ${error.message}`);
      return;
    }
    await loadTeamResources(session.user.id, selectedTeamId);
  }

  function changeClockBy(secondsDelta) {
    const current = parseClockToSeconds(clock, settings.quarterLength);
    const next = Math.max(0, Math.min(settings.quarterLength * 60, current + secondsDelta));
    setClock(formatSecondsAsClock(next));
  }

  function toggleModule(moduleName) {
    const moduleConfig = MODULES.find((module) => module.name === moduleName);
    if (moduleConfig?.alwaysVisible) return;

    setSettings((prev) => ({
      ...prev,
      visibleModules: {
        ...prev.visibleModules,
        [moduleName]: !prev.visibleModules[moduleName]
      }
    }));
  }

  function exportWorkspaceBackup() {
    if (!selectedSeason || !selectedTeam) return;
    const payload = {
      app: 'fieldhockey-hub',
      exportedAt: new Date().toISOString(),
      season: selectedSeason,
      team: selectedTeam,
      players,
      matches,
      events,
      importedStatRows: importedRows
    };
    const safeSeason = selectedSeason.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const safeTeam = selectedTeam.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    downloadTextFile(
      `fieldhockey_backup_${safeSeason}_${safeTeam}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8'
    );
    setSettings((prev) => ({ ...prev, lastBackupAt: new Date().toISOString() }));
    setStatus('Workspace backup exported.');
  }

  function exportStatSheetCsv() {
    const headers = [
      'scope',
      'match_date',
      'opponent',
      'player_number',
      'player_name',
      'events',
      'goals',
      'assists',
      'shots_total',
      'shots_on_target_total',
      'shot_accuracy',
      'goal_conversion',
      'pc_won',
      'pc_goals',
      'pc_conversion',
      'ps_won',
      'ps_scored',
      'ps_conversion',
      'circle_entries',
      'saves',
      'interceptions',
      'tackles_won',
      'turnover_won',
      'turnover_lost',
      'turnover_balance',
      'green_cards',
      'yellow_cards',
      'red_cards',
      'discipline',
      'control_index',
      'finishing_index',
      'transition_index',
      'discipline_index'
    ];

    const rows = playerMatchRows.map((row) =>
      [
        analysisScope,
        row.matchDate,
        row.opponent,
        row.playerNumber ?? '',
        row.playerName,
        row.eventCount,
        row.goals,
        row.assists,
        row.shotsTotal,
        row.shotsOnTargetTotal,
        row.shotAccuracy,
        row.goalConversion,
        row.pcWon,
        row.pcGoals,
        row.pcConversion,
        row.psWon,
        row.psScored,
        row.psConversion,
        row.circleEntries,
        row.saves,
        row.interceptions,
        row.tacklesWon,
        row.turnoverWon,
        row.turnoverLost,
        row.turnoverBalance,
        row.greenCards,
        row.yellowCards,
        row.redCards,
        row.discipline,
        row.controlIndex,
        row.finishingIndex,
        row.transitionIndex,
        row.disciplineIndex
      ].map(toCsvCell)
    );

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const scopeLabel = analysisScope === 'match' ? 'match' : 'season';
    downloadTextFile(`fieldhockey_stat_sheet_player_match_${scopeLabel}.csv`, csv, 'text/csv;charset=utf-8');
  }

  function exportStatSheetTemplate() {
    const headers = [
      'opponent',
      'match_date',
      'goals',
      'assists',
      'shots_total',
      'shots_on_target_total',
      'pc_won',
      'pc_goals',
      'ps_won',
      'ps_scored',
      'circle_entries',
      'saves',
      'interceptions',
      'tackles_won',
      'turnover_won',
      'turnover_lost',
      'green_cards',
      'yellow_cards',
      'red_cards'
    ];
    const sample = ['Example Club', '2026-03-01', '2', '1', '11', '6', '4', '1', '1', '1', '13', '3', '5', '4', '7', '5', '1', '0', '0'];
    const csv = `${headers.join(',')}\n${sample.join(',')}\n`;
    downloadTextFile('fieldhockey_stat_sheet_template.csv', csv, 'text/csv;charset=utf-8');
  }

  function onImportFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = parseStatSheetCsv(String(reader.result || ''));
      setImportReport(result);
      if (result.rows.length) {
        setImportedRows((prev) => [...result.rows, ...prev]);
        setStatus(`Imported ${result.rows.length} stat sheet row(s).`);
      } else {
        setStatus('No valid rows found in import.');
      }
    };
    reader.onerror = () => setStatus('Could not read import file.');

    reader.readAsText(file);
    event.target.value = '';
  }

  function clearImportedRows() {
    if (!window.confirm('Clear imported stat sheet rows for this team?')) return;
    setImportedRows([]);
    setImportReport(null);
    setStatus('Imported stat sheet rows cleared.');
  }

  function openImportDialog() {
    hiddenImportInputRef.current?.click();
  }

  function onSelectVideo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(file));
    setVideoName(file.name);
  }

  function openAnalyticsPreferences() {
    if (typeof window !== 'undefined' && typeof window.resetAnalyticsPreferences === 'function') {
      window.resetAnalyticsPreferences();
    }
  }

  function handleSeasonSelect(nextSeasonId) {
    setSelectedSeasonId(nextSeasonId);
    setSelectedTeamId('');
    setSelectedMatchId('');
    setTeams([]);
    if (nextSeasonId) {
      setRestoringWorkspace(true);
    } else {
      setRestoringWorkspace(false);
    }
  }

  function handleSwitchTeam() {
    setSelectedSeasonId('');
    setSelectedTeamId('');
    setSelectedMatchId('');
    setRestoringWorkspace(false);
  }

  function renderHome() {
    const activeMatch = matches.find((match) => match.id === selectedMatchId);

    return (
      <>
        {backupReminderDue ? (
          <section className="panel reminder-panel">
            <h3>Backup reminder</h3>
            <p className="muted">Export a workspace backup to avoid data loss and keep an offline copy.</p>
            <button type="button" className="secondary" onClick={exportWorkspaceBackup}>
              Export backup now
            </button>
          </section>
        ) : null}

        <section className="panel">
          <div className="section-header">
            <h2>Field Hockey Hub</h2>
            <p className="muted">Fast match logging + stat sheet output. Use Event Tracker live, then review season KPIs in Stat Sheet and Analytics.</p>
          </div>

          <div className="kpi-grid">
            <article className="kpi-card"><StatLabel label="Goals" tooltip={statTooltip('goals')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.goals}</strong></article>
            <article className="kpi-card"><StatLabel label="Shots On Target" tooltip={statTooltip('shots_on_target_total')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.shotsOnTargetTotal}</strong></article>
            <article className="kpi-card"><StatLabel label="Shot Accuracy" tooltip={statTooltip('shot_accuracy')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.shotAccuracy}%</strong></article>
            <article className="kpi-card"><StatLabel label="PC Conversion" tooltip={statTooltip('pc_conversion')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.pcConversion}%</strong></article>
            <article className="kpi-card"><StatLabel label="Turnover Balance" tooltip={statTooltip('turnover_balance')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.turnoverBalance}</strong></article>
            <article className="kpi-card"><StatLabel label="Discipline" tooltip={statTooltip('discipline')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.discipline}</strong></article>
          </div>
        </section>

        <section className="panel two-col">
          <article>
            <h3>Workspace</h3>
            <p className="muted">Season: {selectedSeason?.name || '—'}</p>
            <p className="muted">Team: {selectedTeam?.name || '—'}</p>
            <p className="muted">Selected match: {activeMatch ? `${activeMatch.opponent} ${activeMatch.match_date || ''}` : '—'}</p>
            <p className="muted">Players: {players.length}</p>
            <p className="muted">Matches: {matches.length}</p>
            <p className="muted">Events: {events.length}</p>
          </article>
          {settings.showHubTips ? (
            <article>
              <h3>Quick Start</h3>
              <ol>
                <li>Create/select a season and team.</li>
                <li>Add players in Roster.</li>
                <li>Create a match in Matches and select it.</li>
                <li>Track events in Event Tracker during match.</li>
                <li>Use Stat Sheet for season output and exports.</li>
              </ol>
            </article>
          ) : null}
        </section>
      </>
    );
  }

  function renderMatches() {
    return (
      <section className="panel">
        <div className="section-header">
          <h2>Matches</h2>
          <p className="muted">Create and manage matches for the selected season + team (newest first).</p>
        </div>

        <form className="inline-form" onSubmit={createMatch}>
          <input placeholder="Opponent" value={matchForm.opponent} onChange={(event) => setMatchForm((prev) => ({ ...prev, opponent: event.target.value }))} required />
          <input type="date" value={matchForm.match_date} onChange={(event) => setMatchForm((prev) => ({ ...prev, match_date: event.target.value }))} />
          <button type="submit">Add Match</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Opponent</th><th>Date</th><th>Events</th><th>Action</th></tr>
            </thead>
            <tbody>
              {matches.map((match) => {
                const eventCount = events.filter((entry) => entry.match_id === match.id).length;
                return (
                  <tr key={match.id} className={selectedMatchId === match.id ? 'row-active' : ''}>
                    <td>{match.opponent}</td>
                    <td>{match.match_date || '-'}</td>
                    <td>{eventCount}</td>
                    <td className="row-actions">
                      <button type="button" className="secondary" onClick={() => setSelectedMatchId(match.id)}>Select</button>
                      <button type="button" className="danger" onClick={() => deleteMatch(match.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderRoster() {
    return (
      <section className="panel">
        <div className="section-header">
          <h2>Roster</h2>
          <p className="muted">Shared roster across all field hockey modules.</p>
        </div>

        <form className="inline-form" onSubmit={createPlayer}>
          <input placeholder="Player name" value={playerForm.name} onChange={(event) => setPlayerForm((prev) => ({ ...prev, name: event.target.value }))} required />
          <input type="number" placeholder="Number" value={playerForm.number} onChange={(event) => setPlayerForm((prev) => ({ ...prev, number: event.target.value }))} />
          <input placeholder="Position" value={playerForm.position} onChange={(event) => setPlayerForm((prev) => ({ ...prev, position: event.target.value }))} />
          <button type="submit">Add Player</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Name</th><th>Position</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const isEditing = editingPlayerId === player.id;
                return (
                  <tr key={player.id}>
                    <td>{isEditing ? <input type="number" value={editingPlayerForm.number} onChange={(event) => setEditingPlayerForm((prev) => ({ ...prev, number: event.target.value }))} /> : player.number ?? '-'}</td>
                    <td>{isEditing ? <input value={editingPlayerForm.name} onChange={(event) => setEditingPlayerForm((prev) => ({ ...prev, name: event.target.value }))} /> : player.name}</td>
                    <td>{isEditing ? <input value={editingPlayerForm.position} onChange={(event) => setEditingPlayerForm((prev) => ({ ...prev, position: event.target.value }))} /> : player.position || '-'}</td>
                    <td className="row-actions">
                      {isEditing ? (
                        <>
                          <button type="button" className="secondary" onClick={() => savePlayer(player.id)}>Save</button>
                          <button type="button" className="danger" onClick={cancelEditPlayer}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="secondary" onClick={() => startEditPlayer(player)}>Edit</button>
                          <button type="button" className="danger" onClick={() => deletePlayer(player.id)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderEventTracker() {
    const activeActionGroup = ACTION_GROUPS.find((group) => group.key === activeActionGroupKey) || ACTION_GROUPS[0];

    return (
      <section className="panel tracker-panel">
        <div className="section-header compact">
          <h2>Event Tracker</h2>
          <p className="muted">Live mode: period and time stay fixed until you change them.</p>
        </div>

        <div className="tracker-toolbar">
          <label>
            Match
            <select value={selectedMatchId} onChange={(event) => setSelectedMatchId(event.target.value)}>
              {!matches.length ? <option value="">No matches yet</option> : null}
              {matches.map((match) => (
                <option key={match.id} value={match.id}>{match.opponent} {match.match_date ? `(${match.match_date})` : ''}</option>
              ))}
            </select>
          </label>

          <label>
            Period
            <select value={period} onChange={(event) => setPeriod(Number(event.target.value))}>
              <option value={1}>Q1</option>
              <option value={2}>Q2</option>
              <option value={3}>Q3</option>
              <option value={4}>Q4</option>
            </select>
          </label>

          <label>
            Time Left
            <div className="clock-input split">
              <select value={clockParts.minutes} onChange={(event) => setClock(`${event.target.value}:${clockParts.seconds}`)}>
                {minuteOptions.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
              </select>
              <span>:</span>
              <select value={clockParts.seconds} onChange={(event) => setClock(`${clockParts.minutes}:${event.target.value}`)}>
                {secondOptions.map((second) => <option key={second} value={second}>{second}</option>)}
              </select>
            </div>
          </label>

          <div className="time-stepper" aria-label="Adjust time left">
            <button type="button" onClick={() => changeClockBy(10)}>+10s</button>
            <button type="button" onClick={() => changeClockBy(1)}>+1s</button>
            <button type="button" onClick={() => changeClockBy(-1)}>-1s</button>
            <button type="button" onClick={() => changeClockBy(-10)}>-10s</button>
          </div>
        </div>

        <div className="clock-presets compact">
          {clockPresets.map((preset) => (
            <button key={preset} type="button" onClick={() => setClock(preset)} className={clock === preset ? 'preset active' : 'preset'}>
              {preset}
            </button>
          ))}
        </div>

        <div className="tracker-compact-grid">
          <article>
            <h3>Select Player</h3>
            <div className="player-strip">
              {players.map((player) => (
                <button key={player.id} type="button" onClick={() => setSelectedPlayerId(player.id)} className={`player-chip ${selectedPlayerId === player.id ? 'selected' : ''}`}>
                  #{player.number ?? '-'} {player.name}
                </button>
              ))}
            </div>
          </article>

          <article>
            <h3>Log Action</h3>
            <div className="action-group-tabs">
              {ACTION_GROUPS.map((group) => (
                <button key={group.key} type="button" className={activeActionGroup.key === group.key ? 'active' : ''} onClick={() => setActiveActionGroupKey(group.key)}>
                  {group.title}
                </button>
              ))}
            </div>
            <div className="action-grid mobile-dense">
              {activeActionGroup.actions.map((action) => (
                <button key={action.key} type="button" className={`action-button ${action.className}`} title={settings.showStatTooltips ? action.tooltip : ''} onClick={() => addEvent(action.key)}>
                  {action.label}
                </button>
              ))}
            </div>
          </article>
        </div>

        <details className="event-log" open>
          <summary>Latest events ({selectedMatchEvents.length})</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>Player</th><th>Action</th><th /></tr>
              </thead>
              <tbody>
                {selectedMatchEvents.slice(0, 30).map((event) => {
                  const player = players.find((entry) => entry.id === event.player_id);
                  return (
                    <tr key={event.id}>
                      <td>Q{event.period} - {event.time_left || '-'}</td>
                      <td>{player ? `#${player.number ?? '-'} ${player.name}` : '-'}</td>
                      <td>{event.event_type.replaceAll('_', ' ')}</td>
                      <td className="row-actions">
                        <button type="button" className="danger" onClick={() => deleteEvent(event.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    );
  }

  function renderStatSheet() {
    const selectedMatch = matches.find((match) => match.id === selectedMatchId);
    return (
      <section className="panel">
        <div className="section-header">
          <h2>Stat Sheet</h2>
          <p className="muted">Primary output from scoring data: per player, per match rows.</p>
        </div>

        <div className="inline-actions">
          <label>
            Scope
            <select value={analysisScope} onChange={(event) => setAnalysisScope(event.target.value)}>
              <option value="match">Selected match</option>
              <option value="season">Selected team + season</option>
            </select>
          </label>
          {analysisScope === 'match' ? (
            <label>
              Match
              <select value={selectedMatchId} onChange={(event) => setSelectedMatchId(event.target.value)}>
                {matches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.opponent} {match.match_date ? `(${match.match_date})` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Legacy totals source
            <select value={statSheetSource} onChange={(event) => setStatSheetSource(event.target.value)}>
              <option value="all">Generated + Imported</option>
              <option value="generated">Generated only</option>
              <option value="imported">Imported only</option>
            </select>
          </label>
          <button type="button" className="secondary" onClick={exportStatSheetCsv}>Export CSV</button>
          <button type="button" className="secondary" onClick={exportStatSheetTemplate}>Download Template</button>
          <button type="button" className="secondary" onClick={openImportDialog}>Import CSV</button>
          <button type="button" className="danger" onClick={clearImportedRows}>Clear Imports</button>
          <input ref={hiddenImportInputRef} type="file" accept=".csv,text/csv" onChange={onImportFileChange} hidden />
        </div>

        <div className="kpi-grid">
          <article className="kpi-card"><span>Player-Match Rows</span><strong>{playerMatchRows.length}</strong></article>
          <article className="kpi-card"><StatLabel label="Goals" tooltip={statTooltip('goals')} enabled={settings.showStatTooltips} /><strong>{playerMatchSummary.goals}</strong></article>
          <article className="kpi-card"><StatLabel label="Shot Accuracy" tooltip={statTooltip('shot_accuracy')} enabled={settings.showStatTooltips} /><strong>{playerMatchSummary.shotAccuracy}%</strong></article>
          <article className="kpi-card"><StatLabel label="PC Conversion" tooltip={statTooltip('pc_conversion')} enabled={settings.showStatTooltips} /><strong>{playerMatchSummary.pcConversion}%</strong></article>
          <article className="kpi-card"><StatLabel label="Turnover Balance" tooltip={statTooltip('turnover_balance')} enabled={settings.showStatTooltips} /><strong>{playerMatchSummary.turnoverBalance}</strong></article>
          <article className="kpi-card"><StatLabel label="Discipline" tooltip={statTooltip('discipline')} enabled={settings.showStatTooltips} /><strong>{playerMatchSummary.discipline}</strong></article>
        </div>

        {analysisScope === 'match' && selectedMatch ? (
          <p className="muted small">
            Showing rows for: <strong>{selectedMatch.opponent}</strong> {selectedMatch.match_date ? `(${selectedMatch.match_date})` : ''}
          </p>
        ) : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Match</th><th>#</th><th>Player</th><th>Events</th><th>G</th><th>A</th><th>Shots</th><th>SOT</th><th>Acc%</th><th>PC Won</th><th>PC G</th><th>PC%</th><th>TO +/-</th><th>Cards</th></tr>
            </thead>
            <tbody>
              {playerMatchRows.map((row) => (
                <tr key={row.rowId}>
                  <td>{row.matchDate || '-'}</td>
                  <td>{row.opponent}</td>
                  <td>{row.playerNumber ?? '-'}</td>
                  <td>{row.playerName}</td>
                  <td>{row.eventCount}</td>
                  <td>{row.goals}</td>
                  <td>{row.assists}</td>
                  <td>{row.shotsTotal}</td>
                  <td>{row.shotsOnTargetTotal}</td>
                  <td>{row.shotAccuracy}%</td>
                  <td>{row.pcWon}</td>
                  <td>{row.pcGoals}</td>
                  <td>{row.pcConversion}%</td>
                  <td>{row.turnoverBalance}</td>
                  <td>{row.discipline}</td>
                </tr>
              ))}
              {!playerMatchRows.length ? (
                <tr>
                  <td colSpan={15} className="muted">No player-match rows available. Add events in Event Tracker first.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {importReport ? (
          <div className="import-report">
            <h3>Import report</h3>
            <p className="muted">Accepted {importReport.accepted} / {importReport.total} rows.</p>
            {importReport.skipped.length ? (
              <ul>
                {importReport.skipped.slice(0, 10).map((row) => (
                  <li key={`${row.line}_${row.reason}`}>Line {row.line}: {row.reason}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No rejected rows.</p>
            )}
          </div>
        ) : null}

        <details className="event-log">
          <summary>Legacy team/match totals ({statRows.length})</summary>
          <div className="kpi-grid">
            <article className="kpi-card"><span>Matches</span><strong>{statSummary.matches}</strong></article>
            <article className="kpi-card"><StatLabel label="Goals" tooltip={statTooltip('goals')} enabled={settings.showStatTooltips} /><strong>{statSummary.goals}</strong></article>
            <article className="kpi-card"><StatLabel label="Shot Accuracy" tooltip={statTooltip('shot_accuracy')} enabled={settings.showStatTooltips} /><strong>{statSummary.shotAccuracy}%</strong></article>
            <article className="kpi-card"><StatLabel label="PC Conversion" tooltip={statTooltip('pc_conversion')} enabled={settings.showStatTooltips} /><strong>{statSummary.pcConversion}%</strong></article>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Source</th><th>Opponent</th><th>Date</th><th>G</th><th>S</th><th>SOT</th><th>Acc%</th><th>PC Won</th><th>PC G</th><th>PC%</th><th>TO +/-</th><th>Cards</th></tr>
              </thead>
              <tbody>
                {statRows.map((row) => (
                  <tr key={row.rowId}>
                    <td><span className={`source-badge ${row.source}`}>{row.source}</span></td>
                    <td>{row.opponent}</td>
                    <td>{row.matchDate || '-'}</td>
                    <td>{row.goals ?? '-'}</td>
                    <td>{row.shotsTotal ?? '-'}</td>
                    <td>{row.shotsOnTargetTotal ?? '-'}</td>
                    <td>{row.shotAccuracy ?? '-'}%</td>
                    <td>{row.pcWon ?? '-'}</td>
                    <td>{row.pcGoals ?? '-'}</td>
                    <td>{row.pcConversion ?? '-'}%</td>
                    <td>{row.turnoverBalance ?? '-'}</td>
                    <td>{row.discipline ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    );
  }

  function renderAnalytics() {
    return (
      <>
        <section className="panel">
          <div className="section-header inline-between">
            <div>
              <h2>Analytics</h2>
              <p className="muted">Review scope-based KPIs and player output.</p>
            </div>
            <label>
              Scope
              <select value={analysisScope} onChange={(event) => setAnalysisScope(event.target.value)}>
                <option value="match">Selected match</option>
                <option value="season">Selected team + season</option>
              </select>
            </label>
          </div>

          <div className="kpi-grid">
            <article className="kpi-card"><StatLabel label="Goals" tooltip={statTooltip('goals')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.goals}</strong></article>
            <article className="kpi-card"><StatLabel label="Assists" tooltip={statTooltip('assists')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.assists}</strong></article>
            <article className="kpi-card"><StatLabel label="Shots" tooltip={statTooltip('shots_total')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.shotsTotal}</strong></article>
            <article className="kpi-card"><StatLabel label="Shots On Target" tooltip={statTooltip('shots_on_target_total')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.shotsOnTargetTotal}</strong></article>
            <article className="kpi-card"><StatLabel label="Shot Accuracy" tooltip={statTooltip('shot_accuracy')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.shotAccuracy}%</strong></article>
            <article className="kpi-card"><StatLabel label="Goal Conversion" tooltip={statTooltip('goal_conversion')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.goalConversion}%</strong></article>
            <article className="kpi-card"><StatLabel label="PC Won" tooltip={statTooltip('pc_won')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.pcWon}</strong></article>
            <article className="kpi-card"><StatLabel label="PC Conversion" tooltip={statTooltip('pc_conversion')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.pcConversion}%</strong></article>
            <article className="kpi-card"><StatLabel label="PS Conversion" tooltip={statTooltip('ps_conversion')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.psConversion}%</strong></article>
            <article className="kpi-card"><StatLabel label="Circle Entries" tooltip={statTooltip('circle_entries')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.circleEntries}</strong></article>
            <article className="kpi-card"><StatLabel label="Saves" tooltip={statTooltip('saves')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.saves}</strong></article>
            <article className="kpi-card"><StatLabel label="Turnover Balance" tooltip={statTooltip('turnover_balance')} enabled={settings.showStatTooltips} /><strong>{analyticsSummary.turnoverBalance}</strong></article>
          </div>
        </section>

        <section className="panel">
          <h3>Match trends</h3>
          <div className="trend-list">
            {matchRows.map((row) => (
              <article key={row.rowId} className="trend-row">
                <div>
                  <p className="trend-title">{row.opponent}</p>
                  <p className="muted small">{row.matchDate || 'No date'}</p>
                </div>
                <div className="trend-metrics">
                  <span>G {row.goals}</span>
                  <span>S {row.shotsTotal}</span>
                  <span>SOT {row.shotsOnTargetTotal}</span>
                  <span>PC% {row.pcConversion}%</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderPlayers() {
    return (
      <>
        <section className="panel">
          <div className="section-header inline-between">
            <div>
              <h2>Players</h2>
              <p className="muted">Player report cards and contribution comparison for the selected analysis scope.</p>
            </div>
            <label>
              Scope
              <select value={analysisScope} onChange={(event) => setAnalysisScope(event.target.value)}>
                <option value="match">Selected match</option>
                <option value="season">Selected team + season</option>
              </select>
            </label>
          </div>

          <h3>Player report card</h3>
          <select value={reportPlayerId} onChange={(event) => setReportPlayerId(event.target.value)}>
            <option value="">Select player</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                #{player.number ?? '-'} {player.name}
              </option>
            ))}
          </select>
          {playerReport ? (
            <div className="report-grid">
              <p>
                <strong>Player:</strong> #{playerReport.player.number ?? '-'} {playerReport.player.name}
              </p>
              <p>
                <strong>Events:</strong> {playerReport.events}
              </p>
              <p>
                <strong>Contributions:</strong> {playerReport.contributions}
              </p>
              <p>
                <strong>Shots / SOT:</strong> {playerReport.shotsTotal} / {playerReport.shotsOnTargetTotal}
              </p>
              <p>
                <strong>Shot Accuracy:</strong> {playerReport.shotAccuracy}%
              </p>
              <p>
                <strong>Circle Entries:</strong> {playerReport.circleEntries}
              </p>
              <p>
                <strong>Tackles + Interceptions:</strong> {playerReport.tacklesWon + playerReport.interceptions}
              </p>
              <p>
                <strong>Discipline:</strong> {playerReport.discipline}
              </p>
            </div>
          ) : (
            <p className="muted">No player selected.</p>
          )}
        </section>

        <section className="panel">
          <h3>Top output players</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Goals</th>
                  <th>Assists</th>
                  <th>Shots</th>
                  <th>Cards</th>
                </tr>
              </thead>
              <tbody>
                {topPlayers.map((entry) => (
                  <tr key={entry.playerId}>
                    <td>{entry.player ? `#${entry.player.number ?? '-'} ${entry.player.name}` : '-'}</td>
                    <td>{entry.goals}</td>
                    <td>{entry.assists}</td>
                    <td>{entry.shots}</td>
                    <td>{entry.cards}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderVideo() {
    return (
      <section className="panel">
        <h2>Video</h2>
        <p className="muted">Local video review module (no upload to Supabase).</p>
        <div className="inline-actions">
          <input type="file" accept="video/*" onChange={onSelectVideo} />
          <button type="button" className="secondary" onClick={() => videoRef.current?.pause()}>
            Pause
          </button>
          <button type="button" className="secondary" onClick={() => videoRef.current?.play()}>
            Play
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              if (!videoRef.current) return;
              videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
            }}
          >
            -5s
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              if (!videoRef.current) return;
              videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 5);
            }}
          >
            +5s
          </button>
        </div>
        <p className="muted">{videoName || 'No video selected.'}</p>
        {videoUrl ? <video ref={videoRef} className="video-player" controls src={videoUrl} /> : null}
      </section>
    );
  }

  function renderPossession() {
    return (
      <section className="panel">
        <h2>Possession</h2>
        <p className="muted">Advanced analysis placeholder. Next step is full possession-mapping parity like waterpolo.</p>
      </section>
    );
  }

  function renderHelp() {
    return (
      <section className="panel">
        <h2>Help</h2>
        <p className="muted">Core workflow and action legend for new users.</p>

        <div className="two-col">
          <article>
            <h3>Getting started</h3>
            <ol>
              <li>Select/create season and team.</li>
              <li>Add players in Roster.</li>
              <li>Create and select match in Matches.</li>
              <li>Track actions in Event Tracker.</li>
              <li>Review Stat Sheet and Analytics.</li>
            </ol>
          </article>
          <article>
            <h3>Magic link login</h3>
            <p className="muted">Sender (default): <code>no-reply@mail.app.supabase.io</code></p>
            <p className="muted">Subject usually includes: <code>Confirm Your Signup</code></p>
            <p className="muted">Check spam folder if not received.</p>
          </article>
        </div>
      </section>
    );
  }

  function renderPrivacy() {
    return (
      <section className="panel">
        <h2>Privacy</h2>
        <p className="muted">Data is stored in Supabase per user and team workspace.</p>
        <ul>
          <li>Auth via magic link.</li>
          <li>Feature requests stored in Supabase.</li>
          <li>Imported stat rows stored in browser local storage.</li>
          <li>GA4 starts only after consent.</li>
          <li>Contact: info@paulzuiderduin.com</li>
        </ul>
      </section>
    );
  }

  function renderChangelog() {
    return (
      <section className="panel">
        <h2>Changelog</h2>
        <ul>
          <li>Hub parity pass: advanced modules, sidebar collapse, mobile nav, utility dock.</li>
          <li>Workspace selection flow and switch-team flow aligned with waterpolo.</li>
          <li>Backup export added in Settings.</li>
          <li>Scoring/stat-sheet/analytics parity maintained.</li>
        </ul>
      </section>
    );
  }

  function renderSettings() {
    return (
      <section className="panel">
        <div className="section-header">
          <h2>Settings</h2>
          <p className="muted">Control module visibility, UX preferences, and backups.</p>
        </div>

        <div className="settings-grid">
          <article>
            <h3>Visible Modules</h3>
            <div className="toggle-list">
              {MODULES.map((module) => (
                <label key={module.name} className="toggle-item">
                  <input
                    type="checkbox"
                    checked={module.alwaysVisible ? true : settings.visibleModules[module.name] !== false}
                    disabled={module.alwaysVisible}
                    onChange={() => toggleModule(module.name)}
                  />
                  <span>{module.name}</span>
                </label>
              ))}
            </div>
          </article>

          <article>
            <h3>Workspace Preferences</h3>
            <label className="toggle-item">
              <input type="checkbox" checked={settings.rememberLastModule} onChange={(event) => setSettings((prev) => ({ ...prev, rememberLastModule: event.target.checked }))} />
              <span>Remember last module on refresh</span>
            </label>
            <label className="toggle-item">
              <input type="checkbox" checked={settings.showHubTips} onChange={(event) => setSettings((prev) => ({ ...prev, showHubTips: event.target.checked }))} />
              <span>Show dashboard tips</span>
            </label>
            <label className="toggle-item">
              <input type="checkbox" checked={settings.showAdvancedModules} onChange={(event) => setSettings((prev) => ({ ...prev, showAdvancedModules: event.target.checked }))} />
              <span>Show advanced modules</span>
            </label>
            <label className="toggle-item">
              <input type="checkbox" checked={settings.showBackupReminder} onChange={(event) => setSettings((prev) => ({ ...prev, showBackupReminder: event.target.checked }))} />
              <span>Show backup reminder</span>
            </label>
            <label className="toggle-item">
              <input type="checkbox" checked={settings.showStatTooltips} onChange={(event) => setSettings((prev) => ({ ...prev, showStatTooltips: event.target.checked }))} />
              <span>Show tooltips</span>
            </label>
          </article>

          <article>
            <h3>Tracker Defaults</h3>
            <label className="stacked-label">
              Quarter Length (minutes)
              <select value={settings.quarterLength} onChange={(event) => setSettings((prev) => ({ ...prev, quarterLength: Number(event.target.value) }))}>
                <option value={10}>10</option>
                <option value={12}>12</option>
                <option value={15}>15</option>
              </select>
            </label>
            <label className="stacked-label">
              Analytics default scope
              <select value={settings.defaultAnalysisScope} onChange={(event) => setSettings((prev) => ({ ...prev, defaultAnalysisScope: event.target.value }))}>
                <option value="match">Selected match</option>
                <option value="season">Selected team + season</option>
              </select>
            </label>
            <div className="inline-meta-list">
              <button type="button" className="secondary" onClick={exportWorkspaceBackup}>Export backup</button>
              <button type="button" className="secondary" onClick={openAnalyticsPreferences}>Analytics preferences</button>
            </div>
            <p className="muted">Last backup: {settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString() : 'Never'}</p>

            <button
              type="button"
              className="danger"
              onClick={() => {
                setSettings(DEFAULT_SETTINGS);
                setPeriod(1);
                setClock('15:00');
                setAnalysisScope('match');
              }}
            >
              Reset settings
            </button>
          </article>
        </div>
      </section>
    );
  }

  function renderWorkspaceSetup() {
    const teamsForSeason = teams;
    return (
      <div className="setup-layout">
        <section className="panel hero-panel">
          <h1>Seasons & Teams</h1>
          <p className="muted">Select a season and team, or create new folders.</p>
        </section>

        <div className="setup-grid">
          <section className="panel">
            <h2>Seasons</h2>
            <div className="list-stack">
              {seasons.map((season) => (
                <button
                  key={season.id}
                  type="button"
                  className={`list-item ${selectedSeasonId === season.id ? 'active' : ''}`}
                  onClick={() => handleSeasonSelect(season.id)}
                >
                  <span>{season.name}</span>
                  <span className="row-actions">
                    <button type="button" className="secondary" onClick={(event) => { event.stopPropagation(); renameSeason(season); }}>
                      Rename
                    </button>
                    <button type="button" className="danger" onClick={(event) => { event.stopPropagation(); deleteSeason(season.id); }}>
                      Delete
                    </button>
                  </span>
                </button>
              ))}
            </div>

            <form className="inline-form" onSubmit={createSeason}>
              <input placeholder="New season" value={seasonForm.name} onChange={(event) => setSeasonForm({ name: event.target.value })} />
              <button type="submit">+ Season</button>
            </form>
          </section>

          <section className="panel">
            <h2>Teams</h2>
            {!selectedSeasonId ? <p className="muted">Select a season first.</p> : null}
            <div className="list-stack">
              {teamsForSeason.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  className={`list-item ${selectedTeamId === team.id ? 'active' : ''}`}
                  onClick={() => setSelectedTeamId(team.id)}
                >
                  <span>{team.name}</span>
                  <span className="row-actions">
                    <button type="button" className="secondary" onClick={(event) => { event.stopPropagation(); renameTeam(team); }}>
                      Rename
                    </button>
                    <button type="button" className="danger" onClick={(event) => { event.stopPropagation(); deleteTeam(team.id); }}>
                      Delete
                    </button>
                  </span>
                </button>
              ))}
            </div>

            <form className="inline-form" onSubmit={createTeam}>
              <input placeholder="New team" value={teamForm.name} onChange={(event) => setTeamForm({ name: event.target.value })} disabled={!selectedSeasonId} />
              <button type="submit" disabled={!selectedSeasonId}>+ Team</button>
            </form>

            <button type="button" className="secondary" disabled={!selectedSeasonId || !selectedTeamId} onClick={() => setActiveModule('Home')}>
              Open workspace
            </button>
          </section>

          <section className="panel">
            <h2>Getting started</h2>
            <ol>
              <li>Create a season.</li>
              <li>Select season and create a team.</li>
              <li>Open workspace and add roster.</li>
              <li>Create match, then start logging events.</li>
            </ol>
          </section>
        </div>

        <footer className="footer">
          <span>© 2026 Field Hockey Hub</span>
          <div className="footer-links">
            <button type="button" className="link-btn" onClick={() => setFeatureDialog({ ...EMPTY_REQUEST })}>Request Feature</button>
            <button type="button" className="link-btn" onClick={openAnalyticsPreferences}>Analytics preferences</button>
            <button type="button" className="link-btn" onClick={() => setActiveModule('Privacy')}>Privacy</button>
          </div>
        </footer>
      </div>
    );
  }

  function renderModule() {
    if (activeModule === 'Matches') return renderMatches();
    if (activeModule === 'Roster') return renderRoster();
    if (activeModule === 'Players') return renderPlayers();
    if (activeModule === 'Event Tracker') return renderEventTracker();
    if (activeModule === 'Stat Sheet') return renderStatSheet();
    if (activeModule === 'Analytics') return renderAnalytics();
    if (activeModule === 'Video') return renderVideo();
    if (activeModule === 'Possession') return renderPossession();
    if (activeModule === 'Help') return renderHelp();
    if (activeModule === 'Privacy') return renderPrivacy();
    if (activeModule === 'Changelog') return renderChangelog();
    if (activeModule === 'Settings') return renderSettings();
    return renderHome();
  }

  if (authLoading) {
    return (
      <div className="page-shell">
        <p className="status">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={sendMagicLink}>
          <img className="auth-logo" src="/logos/fieldhockey-logo-light.png" alt="Field Hockey Hub" />
          <h1>Field Hockey Hub</h1>
          <p>Sign in with a magic link to access your seasons, teams, and stats.</p>
          <div className="auth-note">
            <strong>How the email looks</strong>
            <span>Sender: <code>no-reply@mail.app.supabase.io</code></span>
            <span>Subject usually includes: <code>Confirm Your Signup</code></span>
          </div>
          <input type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <button type="submit" disabled={authBusy}>{authBusy ? 'Sending...' : 'Send Magic Link'}</button>
          {status ? <p className="status">{status}</p> : null}
        </form>
      </div>
    );
  }

  if (restoringWorkspace && (!selectedSeason || !selectedTeam)) {
    return (
      <div className="page-shell">
        <p className="status">Restoring workspace...</p>
      </div>
    );
  }

  if (!selectedSeason || !selectedTeam) {
    return (
      <>
        {renderWorkspaceSetup()}
        {featureDialog ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal">
              <h3>Request Feature</h3>
              <p className="muted">Or email directly: <a href="mailto:info@paulzuiderduin.com">info@paulzuiderduin.com</a></p>
              <label className="stacked-label">Subject<input value={featureDialog.subject} onChange={(event) => setFeatureDialog((prev) => (prev ? { ...prev, subject: event.target.value } : prev))} /></label>
              <label className="stacked-label">Message<textarea rows={5} value={featureDialog.message} onChange={(event) => setFeatureDialog((prev) => (prev ? { ...prev, message: event.target.value } : prev))} /></label>
              {featureDialog.error ? <p className="status danger-status">{featureDialog.error}</p> : null}
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setFeatureDialog(null)}>Cancel</button>
                <button type="button" onClick={submitFeatureRequest} disabled={featureDialog.submitting}>{featureDialog.submitting ? 'Submitting...' : 'Submit'}</button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className={`layout ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-logo" src="/logos/fieldhockey-logo-dark.png" alt="Field Hockey Hub" />
          {!sidebarCollapsed ? (
            <div>
              <p className="brand-eyebrow">Sport-Tech</p>
              <h1>Field Hockey Hub</h1>
            </div>
          ) : null}
          <button type="button" className="sidebar-toggle" onClick={() => setSidebarCollapsed((prev) => !prev)}>
            {sidebarCollapsed ? '>' : '<'}
          </button>
        </div>

        <nav>
          {visibleModules.map((module) => (
            <button key={module} className={`nav-item ${activeModule === module ? 'active' : ''}`} onClick={() => setActiveModule(module)} title={module}>
              {sidebarCollapsed ? module.split(' ').map((part) => part[0]).join('') : module}
            </button>
          ))}
        </nav>

        <button className="feature-link big" onClick={() => setFeatureDialog({ ...EMPTY_REQUEST })}>Request Feature</button>
        <button className="feature-link" onClick={openAnalyticsPreferences}>Analytics Preferences</button>
        <button className="feature-link" onClick={handleSwitchTeam}>Switch Team</button>
        <button className="signout" onClick={signOut}>Sign out</button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="brand-eyebrow-inline">Field Hockey Hub</p>
            <h2>{activeModule}</h2>
            <p className="muted">{MODULE_COPY[activeModule] || 'Field hockey team workspace.'}</p>
          </div>

          <div className="selectors">
            <label className="top-select">
              Season
              <select value={selectedSeasonId} onChange={(event) => handleSeasonSelect(event.target.value)}>
                <option value="">Select season</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="top-select">
              Team
              <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>
                <option value="">Select team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {loadingData ? <p className="status">Loading data...</p> : null}
        {status && !loadingData ? <p className="status">{status}</p> : null}

        {renderModule()}

        <footer className="footer">
          <span>© 2026 Field Hockey Hub</span>
          <div className="footer-links">
            <button type="button" className="link-btn" onClick={() => setFeatureDialog({ ...EMPTY_REQUEST })}>Request Feature</button>
            <button type="button" className="link-btn" onClick={() => setActiveModule('Privacy')}>Privacy</button>
            <button type="button" className="link-btn" onClick={openAnalyticsPreferences}>Analytics</button>
          </div>
        </footer>
      </main>

      <div className="utility-dock">
        <button type="button" className="dock-primary" onClick={() => setFeatureDialog({ ...EMPTY_REQUEST })}>Request Feature</button>
        <button type="button" className="dock-secondary" onClick={openAnalyticsPreferences}>Analytics preferences</button>
      </div>

      <div className="mobile-nav">
        {mobilePrimaryModules.slice(0, 4).map((module) => (
          <button key={module} type="button" className={activeModule === module ? 'active' : ''} onClick={() => { setActiveModule(module); setMobileMenuOpen(false); }}>
            {module}
          </button>
        ))}
        <button type="button" onClick={() => setMobileMenuOpen((prev) => !prev)}>More</button>
      </div>
      {mobileMenuOpen ? (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={(event) => event.stopPropagation()}>
            {mobileOverflowModules.map((module) => (
              <button key={module} type="button" onClick={() => { setActiveModule(module); setMobileMenuOpen(false); }}>
                {module}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                handleSwitchTeam();
                setMobileMenuOpen(false);
              }}
            >
              Switch Team
            </button>
            <button type="button" onClick={() => { openAnalyticsPreferences(); setMobileMenuOpen(false); }}>Analytics preferences</button>
            <button type="button" onClick={() => { setFeatureDialog({ ...EMPTY_REQUEST }); setMobileMenuOpen(false); }}>Request Feature</button>
          </div>
        </div>
      ) : null}

      {featureDialog ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Request Feature</h3>
            <p className="muted">Or email directly: <a href="mailto:info@paulzuiderduin.com">info@paulzuiderduin.com</a></p>
            <label className="stacked-label">Subject<input value={featureDialog.subject} onChange={(event) => setFeatureDialog((prev) => (prev ? { ...prev, subject: event.target.value } : prev))} /></label>
            <label className="stacked-label">Message<textarea rows={5} value={featureDialog.message} onChange={(event) => setFeatureDialog((prev) => (prev ? { ...prev, message: event.target.value } : prev))} /></label>
            {featureDialog.error ? <p className="status danger-status">{featureDialog.error}</p> : null}
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setFeatureDialog(null)}>Cancel</button>
              <button type="button" onClick={submitFeatureRequest} disabled={featureDialog.submitting}>{featureDialog.submitting ? 'Submitting...' : 'Submit'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
