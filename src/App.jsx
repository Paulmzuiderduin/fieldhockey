import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { supabase } from './lib/supabase';

const MODULES = ['Home', 'Matches', 'Roster', 'Event Tracker', 'Analytics'];

const ACTION_GROUPS = [
  {
    title: 'Attacking',
    actions: [
      { key: 'goal', label: 'Goal', className: 'action-goal' },
      { key: 'assist', label: 'Assist', className: 'action-assist' },
      { key: 'shot', label: 'Shot', className: 'action-shot' },
      { key: 'shot_on_target', label: 'Shot On Target', className: 'action-shot-target' },
      { key: 'circle_entry', label: 'Circle Entry', className: 'action-circle' },
      { key: 'pc_won', label: 'PC Won', className: 'action-pc' },
      { key: 'pc_goal', label: 'PC Goal', className: 'action-pc-goal' },
      { key: 'ps_won', label: 'PS Won', className: 'action-ps' },
      { key: 'ps_scored', label: 'PS Scored', className: 'action-ps-goal' }
    ]
  },
  {
    title: 'Defending',
    actions: [
      { key: 'save', label: 'Save', className: 'action-save' },
      { key: 'interception', label: 'Interception', className: 'action-interception' },
      { key: 'tackle_won', label: 'Tackle Won', className: 'action-tackle' },
      { key: 'turnover_won', label: 'Turnover Won', className: 'action-turnover-won' },
      { key: 'turnover_lost', label: 'Turnover Lost', className: 'action-turnover-lost' },
      { key: 'pc_conceded', label: 'PC Conceded', className: 'action-pc-conceded' },
      { key: 'card_green', label: 'Green Card', className: 'action-card-green' },
      { key: 'card_yellow', label: 'Yellow Card', className: 'action-card-yellow' },
      { key: 'card_red', label: 'Red Card', className: 'action-card-red' }
    ]
  }
];

const EMPTY_FORM = { name: '' };
const EMPTY_PLAYER_FORM = { name: '', number: '', position: '' };
const EMPTY_MATCH_FORM = { opponent: '', match_date: '' };

function toCountMap(events) {
  return events.reduce((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1;
    return acc;
  }, {});
}

function toPercent(top, bottom) {
  if (!bottom) return '0%';
  return `${Math.round((top / bottom) * 100)}%`;
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [email, setEmail] = useState('');

  const [activeModule, setActiveModule] = useState('Home');
  const [status, setStatus] = useState('');

  const [seasons, setSeasons] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [events, setEvents] = useState([]);

  const [loadingData, setLoadingData] = useState(false);

  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState('');

  const [seasonForm, setSeasonForm] = useState(EMPTY_FORM);
  const [teamForm, setTeamForm] = useState(EMPTY_FORM);
  const [playerForm, setPlayerForm] = useState(EMPTY_PLAYER_FORM);
  const [matchForm, setMatchForm] = useState(EMPTY_MATCH_FORM);

  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [period, setPeriod] = useState(1);
  const [clock, setClock] = useState('15:00');

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
    if (!session?.user?.id) {
      setSeasons([]);
      setTeams([]);
      setPlayers([]);
      setMatches([]);
      setEvents([]);
      return;
    }
    loadSeasons(session.user.id);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || !selectedSeasonId) {
      setTeams([]);
      return;
    }
    loadTeams(session.user.id, selectedSeasonId);
  }, [session?.user?.id, selectedSeasonId]);

  useEffect(() => {
    if (!session?.user?.id || !selectedTeamId) {
      setPlayers([]);
      setMatches([]);
      setEvents([]);
      return;
    }
    loadTeamResources(session.user.id, selectedTeamId);
  }, [session?.user?.id, selectedTeamId]);

  useEffect(() => {
    if (selectedMatchId && !matches.find((match) => match.id === selectedMatchId)) {
      setSelectedMatchId('');
    }
  }, [matches, selectedMatchId]);

  const filteredEvents = useMemo(() => {
    if (!selectedMatchId) return events;
    return events.filter((event) => event.match_id === selectedMatchId);
  }, [events, selectedMatchId]);

  const eventCounts = useMemo(() => toCountMap(filteredEvents), [filteredEvents]);

  const kpis = useMemo(() => {
    const goals = eventCounts.goal || 0;
    const assists = eventCounts.assist || 0;
    const shots = eventCounts.shot || 0;
    const shotsOnTarget = eventCounts.shot_on_target || 0;
    const pcWon = eventCounts.pc_won || 0;
    const pcGoal = eventCounts.pc_goal || 0;
    const psWon = eventCounts.ps_won || 0;
    const psScored = eventCounts.ps_scored || 0;
    const turnoverWon = eventCounts.turnover_won || 0;
    const turnoverLost = eventCounts.turnover_lost || 0;

    return {
      goals,
      assists,
      shots,
      shotsOnTarget,
      shotAccuracy: toPercent(shotsOnTarget, shots),
      goalConversion: toPercent(goals, shots),
      pcWon,
      pcGoal,
      pcConversion: toPercent(pcGoal, pcWon),
      psWon,
      psScored,
      psConversion: toPercent(psScored, psWon),
      circleEntries: eventCounts.circle_entry || 0,
      saves: eventCounts.save || 0,
      interceptions: eventCounts.interception || 0,
      tacklesWon: eventCounts.tackle_won || 0,
      turnoverWon,
      turnoverLost,
      turnoverBalance: turnoverWon - turnoverLost,
      greenCards: eventCounts.card_green || 0,
      yellowCards: eventCounts.card_yellow || 0,
      redCards: eventCounts.card_red || 0
    };
  }, [eventCounts]);

  const topPlayers = useMemo(() => {
    const byPlayer = {};
    for (const event of filteredEvents) {
      if (!event.player_id) continue;
      if (!byPlayer[event.player_id]) {
        byPlayer[event.player_id] = {
          playerId: event.player_id,
          goals: 0,
          assists: 0,
          shots: 0,
          cards: 0
        };
      }
      if (event.event_type === 'goal') byPlayer[event.player_id].goals += 1;
      if (event.event_type === 'assist') byPlayer[event.player_id].assists += 1;
      if (event.event_type === 'shot') byPlayer[event.player_id].shots += 1;
      if (['card_green', 'card_yellow', 'card_red'].includes(event.event_type)) byPlayer[event.player_id].cards += 1;
    }

    return Object.values(byPlayer)
      .map((row) => ({ ...row, player: players.find((p) => p.id === row.playerId) }))
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.shots - a.shots)
      .slice(0, 8);
  }, [filteredEvents, players]);

  async function loadSeasons(userId) {
    setLoadingData(true);
    setStatus('Loading seasons...');

    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      setStatus(`Failed to load seasons: ${error.message}`);
      setLoadingData(false);
      return;
    }

    setSeasons(data || []);
    if (!selectedSeasonId && data?.length) setSelectedSeasonId(data[0].id);
    if (selectedSeasonId && !(data || []).find((season) => season.id === selectedSeasonId)) {
      setSelectedSeasonId(data?.[0]?.id || '');
    }

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
      return;
    }

    setTeams(data || []);
    if (!selectedTeamId && data?.length) setSelectedTeamId(data[0].id);
    if (selectedTeamId && !(data || []).find((team) => team.id === selectedTeamId)) {
      setSelectedTeamId(data?.[0]?.id || '');
    }
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

    setPlayers(playersResult.data || []);
    setMatches(matchesResult.data || []);

    const matchIds = (matchesResult.data || []).map((match) => match.id);
    if (!matchIds.length) {
      setEvents([]);
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
    setStatus('');
    setLoadingData(false);
  }

  async function sendMagicLink(event) {
    event.preventDefault();
    if (!email) {
      setStatus('Enter an email address first.');
      return;
    }

    setAuthBusy(true);
    setStatus('Sending magic link...');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
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
    setSelectedSeasonId('');
    setSelectedTeamId('');
    setSelectedMatchId('');
    setStatus('Signed out.');
  }

  async function createSeason(event) {
    event.preventDefault();
    if (!seasonForm.name.trim() || !session?.user?.id) return;

    const { error } = await supabase.from('seasons').insert({
      name: seasonForm.name.trim(),
      user_id: session.user.id
    });

    if (error) {
      setStatus(`Failed to create season: ${error.message}`);
      return;
    }

    setSeasonForm(EMPTY_FORM);
    await loadSeasons(session.user.id);
  }

  async function createTeam(event) {
    event.preventDefault();
    if (!teamForm.name.trim() || !session?.user?.id || !selectedSeasonId) return;

    const { error } = await supabase.from('teams').insert({
      name: teamForm.name.trim(),
      season_id: selectedSeasonId,
      user_id: session.user.id
    });

    if (error) {
      setStatus(`Failed to create team: ${error.message}`);
      return;
    }

    setTeamForm(EMPTY_FORM);
    await loadTeams(session.user.id, selectedSeasonId);
  }

  async function createPlayer(event) {
    event.preventDefault();
    if (!playerForm.name.trim() || !session?.user?.id || !selectedTeamId) return;

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

  async function createMatch(event) {
    event.preventDefault();
    if (!matchForm.opponent.trim() || !session?.user?.id || !selectedTeamId) return;

    const payload = {
      user_id: session.user.id,
      team_id: selectedTeamId,
      opponent: matchForm.opponent.trim(),
      match_date: matchForm.match_date || null
    };

    const { error } = await supabase.from('matches').insert(payload);

    if (error) {
      setStatus(`Failed to create match: ${error.message}`);
      return;
    }

    setMatchForm(EMPTY_MATCH_FORM);
    await loadTeamResources(session.user.id, selectedTeamId);
  }

  async function deleteMatch(matchId) {
    if (!session?.user?.id) return;
    const { error } = await supabase.from('matches').delete().eq('id', matchId).eq('user_id', session.user.id);
    if (error) {
      setStatus(`Failed to delete match: ${error.message}`);
      return;
    }
    await loadTeamResources(session.user.id, selectedTeamId);
  }

  async function addEvent(actionKey) {
    if (!session?.user?.id || !selectedTeamId) {
      setStatus('Select a season and team first.');
      return;
    }
    if (!selectedMatchId) {
      setStatus('Create or select a match before logging events.');
      return;
    }

    const payload = {
      user_id: session.user.id,
      match_id: selectedMatchId,
      player_id: selectedPlayerId || null,
      event_type: actionKey,
      period,
      time_left: clock
    };

    const { error } = await supabase.from('events').insert(payload);

    if (error) {
      setStatus(`Failed to add event: ${error.message}`);
      return;
    }

    await loadTeamResources(session.user.id, selectedTeamId);
  }

  function renderHome() {
    return (
      <>
        <section className="panel">
          <h2>Field Hockey Hub</h2>
          <p className="muted">
            Track the most-used team KPIs in one flow: shots, shots on target, goals, penalty corners, cards, circle
            entries, turnovers, and defensive actions.
          </p>
          <div className="kpi-grid">
            <article className="kpi-card">
              <span>Goals</span>
              <strong>{kpis.goals}</strong>
            </article>
            <article className="kpi-card">
              <span>Shots On Target</span>
              <strong>{kpis.shotsOnTarget}</strong>
            </article>
            <article className="kpi-card">
              <span>Shot Accuracy</span>
              <strong>{kpis.shotAccuracy}</strong>
            </article>
            <article className="kpi-card">
              <span>PC Conversion</span>
              <strong>{kpis.pcConversion}</strong>
            </article>
            <article className="kpi-card">
              <span>Turnover Balance</span>
              <strong>{kpis.turnoverBalance}</strong>
            </article>
            <article className="kpi-card">
              <span>Cards</span>
              <strong>{kpis.greenCards + kpis.yellowCards + kpis.redCards}</strong>
            </article>
          </div>
        </section>

        <section className="panel two-col">
          <article>
            <h3>Getting Started</h3>
            <ol>
              <li>Create a season and team in the top bar.</li>
              <li>Add players in the Roster module.</li>
              <li>Create a match in Matches.</li>
              <li>Log events in Event Tracker.</li>
              <li>Use Analytics for conversion and player output.</li>
            </ol>
          </article>
          <article>
            <h3>Current Scope</h3>
            <p className="muted">Analytics scope: {selectedMatchId ? 'Selected match' : 'Whole selected team + season'}</p>
            <p className="muted">Players in roster: {players.length}</p>
            <p className="muted">Matches logged: {matches.length}</p>
            <p className="muted">Events logged: {events.length}</p>
          </article>
        </section>
      </>
    );
  }

  function renderMatches() {
    return (
      <section className="panel">
        <div className="section-header">
          <h2>Matches</h2>
          <p className="muted">Create matches for the selected season + team.</p>
        </div>

        <form className="inline-form" onSubmit={createMatch}>
          <input
            placeholder="Opponent"
            value={matchForm.opponent}
            onChange={(event) => setMatchForm((prev) => ({ ...prev, opponent: event.target.value }))}
            required
          />
          <input
            type="date"
            value={matchForm.match_date}
            onChange={(event) => setMatchForm((prev) => ({ ...prev, match_date: event.target.value }))}
          />
          <button type="submit">Add Match</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Opponent</th>
                <th>Date</th>
                <th>Events</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => {
                const count = events.filter((event) => event.match_id === match.id).length;
                return (
                  <tr key={match.id} className={selectedMatchId === match.id ? 'row-active' : ''}>
                    <td>{match.opponent}</td>
                    <td>{match.match_date || '-'}</td>
                    <td>{count}</td>
                    <td className="row-actions">
                      <button type="button" className="secondary" onClick={() => setSelectedMatchId(match.id)}>
                        Select
                      </button>
                      <button type="button" className="danger" onClick={() => deleteMatch(match.id)}>
                        Delete
                      </button>
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
          <p className="muted">One shared roster per selected team.</p>
        </div>

        <form className="inline-form" onSubmit={createPlayer}>
          <input
            placeholder="Player name"
            value={playerForm.name}
            onChange={(event) => setPlayerForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <input
            type="number"
            placeholder="Number"
            value={playerForm.number}
            onChange={(event) => setPlayerForm((prev) => ({ ...prev, number: event.target.value }))}
          />
          <input
            placeholder="Position"
            value={playerForm.position}
            onChange={(event) => setPlayerForm((prev) => ({ ...prev, position: event.target.value }))}
          />
          <button type="submit">Add Player</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Position</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id}>
                  <td>{player.number ?? '-'}</td>
                  <td>{player.name}</td>
                  <td>{player.position || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderEventTracker() {
    return (
      <section className="panel">
        <div className="section-header">
          <h2>Event Tracker</h2>
          <p className="muted">Select a player + action button. Period and clock stay fixed until you change them.</p>
        </div>

        <div className="tracker-controls">
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
            <input
              value={clock}
              pattern="^([0-1]?[0-9]):[0-5][0-9]$"
              onChange={(event) => setClock(event.target.value)}
              placeholder="15:00"
            />
          </label>
          <label>
            Match Filter
            <select value={selectedMatchId} onChange={(event) => setSelectedMatchId(event.target.value)}>
              <option value="">All matches</option>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.opponent} {match.match_date ? `(${match.match_date})` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h3>Select Player</h3>
        <div className="player-grid">
          {players.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => setSelectedPlayerId(player.id)}
              className={`player-chip ${selectedPlayerId === player.id ? 'selected' : ''}`}
            >
              #{player.number ?? '-'} {player.name}
            </button>
          ))}
        </div>

        <h3>Log Action</h3>
        <div className="action-groups">
          {ACTION_GROUPS.map((group) => (
            <article key={group.title} className="action-group">
              <h4>{group.title}</h4>
              <div className="action-grid">
                {group.actions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className={`action-button ${action.className}`}
                    onClick={() => addEvent(action.key)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>

        <h3>Latest Events</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Player</th>
                <th>Action</th>
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.slice(0, 20).map((event) => {
                const player = players.find((item) => item.id === event.player_id);
                const match = matches.find((item) => item.id === event.match_id);
                return (
                  <tr key={event.id}>
                    <td>Q{event.period} - {event.time_left || '-'}</td>
                    <td>{player ? `#${player.number ?? '-'} ${player.name}` : '-'}</td>
                    <td>{event.event_type.replaceAll('_', ' ')}</td>
                    <td>{match?.opponent || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderAnalytics() {
    return (
      <>
        <section className="panel">
          <div className="section-header">
            <h2>Analytics</h2>
            <p className="muted">Most-used field hockey KPIs for team analysis.</p>
          </div>

          <div className="kpi-grid">
            <article className="kpi-card"><span>Goals</span><strong>{kpis.goals}</strong></article>
            <article className="kpi-card"><span>Assists</span><strong>{kpis.assists}</strong></article>
            <article className="kpi-card"><span>Shots</span><strong>{kpis.shots}</strong></article>
            <article className="kpi-card"><span>Shots On Target</span><strong>{kpis.shotsOnTarget}</strong></article>
            <article className="kpi-card"><span>Shot Accuracy</span><strong>{kpis.shotAccuracy}</strong></article>
            <article className="kpi-card"><span>Goal Conversion</span><strong>{kpis.goalConversion}</strong></article>
            <article className="kpi-card"><span>PC Won</span><strong>{kpis.pcWon}</strong></article>
            <article className="kpi-card"><span>PC Goal</span><strong>{kpis.pcGoal}</strong></article>
            <article className="kpi-card"><span>PC Conversion</span><strong>{kpis.pcConversion}</strong></article>
            <article className="kpi-card"><span>PS Conversion</span><strong>{kpis.psConversion}</strong></article>
            <article className="kpi-card"><span>Circle Entries</span><strong>{kpis.circleEntries}</strong></article>
            <article className="kpi-card"><span>Saves</span><strong>{kpis.saves}</strong></article>
            <article className="kpi-card"><span>Interceptions</span><strong>{kpis.interceptions}</strong></article>
            <article className="kpi-card"><span>Tackles Won</span><strong>{kpis.tacklesWon}</strong></article>
            <article className="kpi-card"><span>Turnover Balance</span><strong>{kpis.turnoverBalance}</strong></article>
            <article className="kpi-card"><span>Cards (G/Y/R)</span><strong>{kpis.greenCards}/{kpis.yellowCards}/{kpis.redCards}</strong></article>
          </div>
        </section>

        <section className="panel">
          <h3>Top Player Output</h3>
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

  function renderModule() {
    if (activeModule === 'Matches') return renderMatches();
    if (activeModule === 'Roster') return renderRoster();
    if (activeModule === 'Event Tracker') return renderEventTracker();
    if (activeModule === 'Analytics') return renderAnalytics();
    return renderHome();
  }

  if (authLoading) {
    return <div className="page-shell"><p className="status">Loading...</p></div>;
  }

  if (!session) {
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={sendMagicLink}>
          <h1>Field Hockey Hub</h1>
          <p>Sign in with a magic link to access your seasons, teams, and events.</p>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button type="submit" disabled={authBusy}>{authBusy ? 'Sending...' : 'Send Magic Link'}</button>
          {status ? <p className="status">{status}</p> : null}
        </form>
      </div>
    );
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand-eyebrow">Sport-Tech</p>
          <h1>Field Hockey Hub</h1>
        </div>
        <nav>
          {MODULES.map((module) => (
            <button
              key={module}
              className={`nav-item ${activeModule === module ? 'active' : ''}`}
              onClick={() => setActiveModule(module)}
            >
              {module}
            </button>
          ))}
        </nav>
        <button className="signout" onClick={signOut}>Sign out</button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="muted">{getTimeGreeting()}</p>
            <h2>{activeModule}</h2>
          </div>

          <div className="selectors">
            <form className="tiny-form" onSubmit={createSeason}>
              <select value={selectedSeasonId} onChange={(event) => setSelectedSeasonId(event.target.value)}>
                <option value="">Select season</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>{season.name}</option>
                ))}
              </select>
              <input
                placeholder="New season"
                value={seasonForm.name}
                onChange={(event) => setSeasonForm({ name: event.target.value })}
              />
              <button type="submit">+ Season</button>
            </form>

            <form className="tiny-form" onSubmit={createTeam}>
              <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>
                <option value="">Select team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              <input
                placeholder="New team"
                value={teamForm.name}
                onChange={(event) => setTeamForm({ name: event.target.value })}
              />
              <button type="submit">+ Team</button>
            </form>
          </div>
        </header>

        {loadingData ? <p className="status">Loading data...</p> : null}
        {status && !loadingData ? <p className="status">{status}</p> : null}

        {renderModule()}
      </main>
    </div>
  );
}

export default App;
