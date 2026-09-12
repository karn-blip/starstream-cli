#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');
const os = require('os');
const path = require('path');
const fs = require('fs');

const IS_WIN = process.platform === 'win32';

// ── True-Color ANSI Primitives ────────────────────────────────────────────────
function rgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function fg(hex, s)    { const [r, g, b] = rgb(hex); return `\x1b[38;2;${r};${g};${b}m${s}\x1b[39m`; }
function bg(hex, s)    { const [r, g, b] = rgb(hex); return `\x1b[48;2;${r};${g};${b}m${s}\x1b[49m`; }
function stripAnsi(s)  { return s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '').replace(/\x1b./g, ''); }

// ── Automatic Background Injector for Windows Terminal ────────────────────────
function applyWindowsTerminalBackground() {
  if (!IS_WIN) return;
  const bgFile = path.resolve(__dirname, 'background.jpg');
  if (!fs.existsSync(bgFile)) return;

  const normalizedBg = bgFile.replace(/\\/g, '/');
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return;

  const candidatePaths = [
    path.join(localAppData, 'Packages', 'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
    path.join(localAppData, 'Packages', 'Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
    path.join(localAppData, 'Microsoft', 'Windows Terminal', 'settings.json'),
  ];

  for (const settingsPath of candidatePaths) {
    if (fs.existsSync(settingsPath)) {
      try {
        const raw = fs.readFileSync(settingsPath, 'utf8');
        const settings = JSON.parse(raw);

        if (!settings.profiles) settings.profiles = {};
        if (!settings.profiles.defaults) settings.profiles.defaults = {};

        let modified = false;
        const def = settings.profiles.defaults;
        if (def.backgroundImage !== normalizedBg || def.backgroundImageOpacity !== 0.22) {
          def.backgroundImage = normalizedBg;
          def.backgroundImageOpacity = 0.22;
          def.backgroundImageStretchMode = 'uniformToFill';
          def.backgroundImageAlignment = 'center';
          modified = true;
        }

        const list = settings.profiles.list || [];
        const psProfile = list.find(p => p.name === 'Windows PowerShell' || p.name === 'PowerShell');
        if (psProfile && (psProfile.backgroundImage !== normalizedBg || psProfile.backgroundImageOpacity !== 0.22)) {
          psProfile.backgroundImage = normalizedBg;
          psProfile.backgroundImageOpacity = 0.22;
          psProfile.backgroundImageStretchMode = 'uniformToFill';
          psProfile.backgroundImageAlignment = 'center';
          modified = true;
        }

        if (modified) fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4), 'utf8');
      } catch (err) {}
      break;
    }
  }
}
applyWindowsTerminalBackground();

// ── Themes ───────────────────────────────────────────────────────────────────
const THEMES = {
  'zen-pure': {
    bg: '#1c1917', panel: '#242220', status: '#141210',
    text: '#c9b99a', dim: '#6b5f4f', mid: '#9a8a74',
    accent: '#b8a4d4', accent2: '#8d7db8', gold: '#e0c088',
  },
  'oldest-dream': {
    bg: '#0a0d14', panel: '#121824', status: '#07090e',
    text: '#cbd5e1', dim: '#475569', mid: '#94a3b8',
    accent: '#93c5fd', accent2: '#c084fc', gold: '#fef08a',
  },
  'midnight': {
    bg: '#0e0d14', panel: '#14121e', status: '#08060e',
    text: '#a8a4c0', dim: '#3d3a52', mid: '#6e6a88',
    accent: '#b09cdc', accent2: '#7c6cb8', gold: '#f6d365',
  },
  'dusk': {
    bg: '#1a1520', panel: '#231c2c', status: '#100c14',
    text: '#c4b0cc', dim: '#5a4868', mid: '#8e7898',
    accent: '#e0b8d8', accent2: '#c890bc', gold: '#ffd3b6',
  },
};

let currentTheme = 'zen-pure';
let P = { ...THEMES['zen-pure'] };

function applyTheme(name) {
  const t = THEMES[name];
  if (!t) return false;
  P = { ...t };
  currentTheme = name;
  return true;
}

const c = {
  text:   s => fg(P.text, s),
  dim:    s => fg(P.dim, s),
  mid:    s => fg(P.mid, s),
  accent: s => fg(P.accent, s),
  acc2:   s => fg(P.accent2, s),
  gold:   s => fg(P.gold, s),
};

// ── Persistent Game State ────────────────────────────────────────────────────
const SAVE_PATH = path.resolve(__dirname, '.starstream.json');

let state = {
  incarnationName: os.userInfo().username,
  regressionTurn: 1,
  coins: 5149,
  currentChannel: '#BI-7623',
  sponsor: 'None (Uncontracted)',
  stigma: 'None',
  stigmaDesc: 'Sign a contract via Sponsor Selection.',
  sponsorUnlocked: false,
  sponsorCount: 0,
  totalSponsorsAttempted: 0,
  lastSponsorTime: 0,
  cooldownUntil: 0,
  currentScenarioIdx: 0,
  scenariosCleared: 0,
  coinMultiplier: 1.0,
  hasUnbrokenFaith: false,
  stats: { physique: 10, agility: 10, magic: 10 },
  favor: {
    'Demon-like Judge of Fire': 10,
    'Prisoner of the Golden Headband': 10,
    'Abyssal Black Flame Dragon': 10,
    'Secretive Plotter': 10,
  },
  favorMilestones: {
    'Demon-like Judge of Fire': [],
    'Prisoner of the Golden Headband': [],
    'Abyssal Black Flame Dragon': [],
    'Secretive Plotter': [],
  },
  fables: [
    {
      name: 'Reader of the Ruined World',
      grade: 'Historical',
      desc: 'A story born from witnessing the dawn of the Star Stream.',
      unlockedAt: 'Genesis'
    }
  ]
};

function loadState() {
  try {
    if (fs.existsSync(SAVE_PATH)) {
      const data = JSON.parse(fs.readFileSync(SAVE_PATH, 'utf8'));
      Object.assign(state, data);
      if (!Array.isArray(state.fables) || state.fables.length === 0) {
        state.fables = [
          {
            name: 'Reader of the Ruined World',
            grade: 'Historical',
            desc: 'A story born from witnessing the dawn of the Star Stream.',
            unlockedAt: 'Genesis'
          }
        ];
      }
      if (!state.favor) {
        state.favor = {
          'Demon-like Judge of Fire': 10,
          'Prisoner of the Golden Headband': 10,
          'Abyssal Black Flame Dragon': 10,
          'Secretive Plotter': 10,
        };
      }
      if (!state.favorMilestones) {
        state.favorMilestones = {
          'Demon-like Judge of Fire': [],
          'Prisoner of the Golden Headband': [],
          'Abyssal Black Flame Dragon': [],
          'Secretive Plotter': [],
        };
      }
      if (!state.stats) {
        state.stats = { physique: 10, agility: 10, magic: 10 };
      }
    }
  } catch (e) {}
}

function saveState() {
  try {
    fs.writeFileSync(SAVE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {}
}
loadState();

// ── Stat Modifiers Engine ────────────────────────────────────────────────────
function getStatModifiers() {
  const p = state.stats.physique || 10;
  const a = state.stats.agility || 10;
  const m = state.stats.magic || 10;

  let agilityMultiplier = 1;
  if (state.favorMilestones['Prisoner of the Golden Headband']?.includes(75)) {
    agilityMultiplier = 2;
  }

  let extraCdReduction = 0;
  if (state.favorMilestones['Prisoner of the Golden Headband']?.includes(50)) {
    extraCdReduction += 2;
  }

  return {
    cooldownReduction: Math.max(0, Math.floor((p - 10) / 4)) + extraCdReduction,
    agilityProcChance: Math.min(0.9, (0.15 + (a - 10) * 0.025) * agilityMultiplier),
    magicCoinBoost: parseFloat((1.0 + (m - 10) * 0.02).toFixed(2)),
  };
}

// ── The Fourth Wall Engine ───────────────────────────────────────────────────
function triggerFourthWall(reason) {
  const lines = {
    error: [
      "[The Fourth Wall is shaking slightly.]",
      `[The Fourth Wall says: 'Focus, ${state.incarnationName}. That command was pitiful.']`,
      "[The Fourth Wall absorbs your psychological shock from this syntax catastrophe.]"
    ],
    boredom: [
      "[The Fourth Wall stares into the empty terminal space.]",
      "[The Fourth Wall whispers: 'Read the next chapter.']"
    ]
  };
  const pool = lines[reason] || lines.error;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  console.log(c.dim(`\n  ${picked}\n`));
}

// ── Fables Engine ─────────────────────────────────────────────────────────────
function awardFable(name, grade, desc) {
  if (state.fables.some(f => f.name === name)) return;
  const now = new Date().toLocaleDateString();
  state.fables.push({ name, grade, desc, unlockedAt: now });
  saveState();

  console.log('\n' + c.gold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(c.gold(' [★] A NEW FABLE HAS COMMENCED!'));
  console.log(c.text(' You have earned the ') + c.accent(`[${grade}-grade]`) + c.text(' Fable: ') + c.gold(`'${name}'`));
  console.log(c.dim(` "${desc}"`));
  console.log(c.acc2(' [The Star Stream inscribes your tale into eternity.]'));
  console.log(c.gold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

// ── Constellation Favorability & Milestones ──────────────────────────────────
const FAVOR_MILESTONES = {
  'Demon-like Judge of Fire': {
    25: { msg: "whispers through a private Eden frequency: 'Keep moving forward, Incarnation!'", reward: 500 },
    50: { msg: "blesses your narrative! [Permanent: +15% Scenario Coin Payouts]" },
    75: { msg: "deploys righteous holy fire to shield your terminal from scenario fines." },
    100: { msg: "offers you her ultimate favor! Inherited Stigma: [Judgment Time]!", stigma: 'Judgment Time Lv.1', stigmaDesc: 'Massive holy coin yield surge on scenario milestones.' }
  },
  'Prisoner of the Golden Headband': {
    25: { msg: "chucks a bundle of roasted heavenly peach pits into your lap!", reward: 400 },
    50: { msg: "yawns: 'Move even faster!' [Permanent: -2s Sponsor Begging Cooldown]" },
    75: { msg: "imbues your boots with cloud essence! [Agility coin salvage rate doubled]" },
    100: { msg: "roars in martial triumph! Inherited Stigma: [Somersault Cloud]!", stigma: 'Somersault Cloud Lv.1', stigmaDesc: 'Traversal commands count double toward all scenarios.' }
  },
  'Abyssal Black Flame Dragon': {
    25: { msg: "cackles maniacally at your audacity! (+666 Coins)", reward: 666 },
    50: { msg: "rewards your reckless terminal destruction! [Error bounties boosted to +600 C]" },
    75: { msg: "binds his dark flame seal to your shell prompt." },
    100: { msg: "proclaims you as the Herald of the End! Inherited Stigma: [Apocalypse Ignition]!", stigma: 'Apocalypse Ignition Lv.1', stigmaDesc: 'Command errors trigger a +1500 Coin apocalypse burst.' }
  },
  'Secretive Plotter': {
    25: { msg: "sends a quiet cipher across the margin: 'The story is watching.'", reward: 300 },
    50: { msg: "adjusts your coordinate probabilities. [Stealth navigation coins doubled]" },
    75: { msg: "whispers: 'The next dome scenario demands patience, not haste.'" },
    100: { msg: "unveils the truth of the world line.", fable: { name: "Oldest Dream's Shadow", grade: 'Myth', desc: 'A silhouette walking in step with the one who reads eternity.' } }
  }
};

function adjustFavor(constellation, amount) {
  if (state.favor[constellation] === undefined) return;

  const oldVal = state.favor[constellation];
  const newVal = Math.max(0, Math.min(100, oldVal + amount));
  state.favor[constellation] = newVal;

  if (!state.favorMilestones[constellation]) {
    state.favorMilestones[constellation] = [];
  }

  const milestones = [25, 50, 75, 100];
  milestones.forEach(m => {
    if (oldVal < m && newVal >= m && !state.favorMilestones[constellation].includes(m)) {
      state.favorMilestones[constellation].push(m);
      triggerMilestone(constellation, m);
    }
  });

  saveState();
}

function triggerMilestone(constellation, level) {
  const data = FAVOR_MILESTONES[constellation]?.[level];
  if (!data) return;

  console.log('\n' + c.gold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(c.gold(` [★] FAVORABILITY MILESTONE REACHED: ${level}% with '${constellation}'`));
  console.log(c.text(` [Constellation '${constellation}'] `) + c.acc2(data.msg));

  if (data.reward) {
    state.coins += data.reward;
    console.log(c.gold(` Bonus Grant: +${data.reward} Coins!`));
  }
  if (data.stigma) {
    state.stigma = data.stigma;
    if (data.stigmaDesc) state.stigmaDesc = data.stigmaDesc;
    console.log(c.accent(` New Exclusive Stigma Mastered: [${data.stigma}]`));
  }
  if (data.fable) {
    awardFable(data.fable.name, data.fable.grade, data.fable.desc);
  }
  console.log(c.gold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

// ── Expanded Constellation Roster & Dialogues ─────────────────────────────────
const CONSTELLATIONS = [
  {
    name: 'Most Ancient Liberator',
    reward: 1200,
    messages: [
      'snickers behind a cloud of divine smoke, watching your struggle.',
      'spins his golden staff, bored of the small fry in this scenario.',
      'munches on a heavenly peach and demands a real martial show.',
      'bellows with laughter at the Bureau’s clumsy scenario scripting.',
    ]
  },
  {
    name: 'Father of the Rich Night',
    reward: 1000,
    messages: [
      'silently stamps a dark financial ledger in the Underworld.',
      'regards your survival calculation with stoic, heavy approval.',
      'prepares an Underworld succession registry with your name on it.',
    ]
  },
  {
    name: 'Spear that Parts the Boundaries of the Sea',
    reward: 900,
    messages: [
      'glares through crashing storm surges with oceanic arrogance.',
      'warns you that mortal insolence will be met with a tidal deluge.',
      'strikes the terminal waters with his trident!',
    ]
  },
  {
    name: 'Lightning Throne',
    reward: 950,
    messages: [
      'hurls a bolt of crackling celestial thunder across the dome.',
      'demands absolute submission from low-ranking incarnations.',
      'smirks upon his marble throne at Mount Olympus.',
    ]
  },
  {
    name: 'Scribe of Heaven',
    reward: 800,
    messages: [
      'dips his quill into holy ink, recording your actions into the Great Book.',
      'adjusts his spectacles and calculates your probability balance.',
      'sighs deeply over Eden’s mounting political paperwork.',
    ]
  },
  {
    name: 'Ruler of the East Hell',
    reward: 750,
    messages: [
      'watches with cold reptilian calculation from his iron domain.',
      'analyzes your weaknesses with demonic precision.',
    ]
  },
  {
    name: 'Baal',
    reward: 1100,
    messages: [
      'yawns from the depths of the 1st Demon Realm, waiting for genuine despair.',
      'finds your petty mortal struggles mildly diverting.',
    ]
  },
  {
    name: 'King of Corrupted Angels',
    reward: 850,
    messages: [
      'flutters ash-stained wings and mutters of righteous condemnation.',
      'stares through the channel fog with burning, holy hatred.',
    ]
  },
  {
    name: 'Midday Sun',
    reward: 1000,
    messages: [
      'radiates blinding, scorching heat across the channel frequency.',
      'demands praise worthy of the solar throne of Egypt.',
    ]
  },
  {
    name: 'Demon King of Salvation',
    reward: 1500,
    messages: [
      'gazes at you from beyond the train window with a bitter, faint smile.',
      'silently activates [The Fourth Wall] to shield you from the scenario.',
      'whispers: "Survive this chapter... reader."',
      'sacrifices a handful of his own fable fragments into your balance.',
    ]
  },
  {
    name: 'Ruler of the Deepest Pit',
    reward: 700,
    messages: [
      'stirs inside the bottomless chasm of locusts and venom.',
      'watches the scenario like prey waiting to plummet.',
    ]
  },
  {
    name: 'Supreme God of Light',
    reward: 850,
    messages: [
      'rides his burning golden chariot across the constellation sky.',
      'demands an incandescent display of absolute power!',
    ]
  },
  {
    name: 'One-Eyed Father',
    reward: 950,
    messages: [
      'peers through the branches of Yggdrasil with his remaining eye.',
      'sends the ravens Huginn and Muninn to perch above your terminal.',
      'whispers grim forebodings regarding the coming twilight.',
    ]
  },
  {
    name: 'Great Mother God Who Created Man Out of Earth',
    reward: 900,
    messages: [
      'shapes soft yellow clay with gentle, ancient patience.',
      'looks upon your battered incarnation body with maternal sorrow.',
    ]
  },
  {
    name: 'Emperor of Heavens',
    reward: 1000,
    messages: [
      'stamps an imperial seal onto the celestial bureau decree.',
      'demands order and protocol across all sub-channels.',
    ]
  },
  {
    name: "One Responsible for the Universe's Cycle",
    reward: 1200,
    messages: [
      'chants cosmic verses that spin the wheels of creation and destruction.',
      'watches the scenario timeline reset and loop in cosmic stillness.',
    ]
  },
  {
    name: 'Mirror that Emits Smoke',
    reward: 750,
    messages: [
      'flashes dark obsidian reflections across your screen.',
      'laughs wickedly at the chaos brewing in Seoul Dome.',
    ]
  },
  {
    name: 'Master of Thunder and War',
    reward: 800,
    messages: [
      'slams his heavy bronze axe down, sparking raw lightning.',
      'salutes your uncompromising aggression in the terminal!',
    ]
  },
  {
    name: 'Virtuous Wanggeom',
    reward: 850,
    messages: [
      'watches with solemn grandfatherly pride from the roots of the sacred tree.',
      'whispers ancient blessings over the Korean peninsula dome.',
    ]
  },
  {
    name: 'Demon-like Judge of Fire',
    reward: 600,
    messages: [
      'squeals excitedly and writes a quick fanfiction note.',
      'looks upon your comradeship with shining holy eyes.',
      'cheers for the triumph of justice and love!',
    ]
  },
  {
    name: 'Master of December 25th',
    reward: 800,
    messages: [
      'shines a gentle, sacrificial winter light into the darkness.',
      'blesses your struggle against the cruel scenario logic.',
    ]
  },
  {
    name: 'Master of Abydos',
    reward: 750,
    messages: [
      'weighs your heart against the feather of truth on ancient scales.',
      'wraps linen shroud memories around your previous regression lines.',
    ]
  },
  {
    name: 'Vakarine, Goddess of the Morning Star',
    reward: 650,
    messages: [
      'guides your terminal path with the quiet radiance of dawn.',
      'whispers navigational waypoints through the Guardian Tree.',
    ]
  },
  {
    name: 'Abyssal Black Flame Dragon',
    reward: 666,
    messages: [
      'unleashes a roar of pitch-black apocalyptic flames!',
      'demands you reject boring code and destroy your root directory!',
      'brags that his true sealed power would crash this entire operating system.',
    ]
  },
  {
    name: 'Almighty Sun, Apollo',
    reward: 800,
    messages: [
      'shines with blinding snowfield radiance after consuming ancient fragments.',
      'composes a tragic golden ballad about your doomed journey.',
    ]
  },
  {
    name: 'One Who Rewrites Eternity',
    reward: 1300,
    messages: [
      'scribbles furiously across an endless manuscript of nightmares.',
      'glances up from his typewriter with bloodshot, frantic eyes.',
      'records your terminal keystrokes as canon text in the side story.',
    ]
  },
  {
    name: 'Master of the Erased Margin',
    reward: 1500,
    messages: [
      'wanders across the desolate, blinding snowfield holding a blank manuscript.',
      'reaches out through the white margins of your screen.',
      'whispers: "Are you reading this story until the end?"',
    ]
  },
  {
    name: 'Jormungandr',
    reward: 950,
    messages: [
      'coils his world-encircling venomous body around the channel edges.',
      'hisses low tremors that make your terminal prompt vibrate.',
    ]
  },
  {
    name: 'Flame of the South',
    reward: 800,
    messages: [
      'tastes divine herbal roots and evaluates your incarnation constitution.',
      'stirs ancient medicinal cauldrons inside the <Emperor> nebula.',
    ]
  },
  {
    name: 'Guardian of the Great Horned Leg',
    reward: 850,
    messages: [
      'watches the twilight horizon through the broken lens of prophecy.',
      'blows the Gjallarhorn faintly into the star stream broadcast.',
    ]
  }
];

const MOCK_MESSAGES = [
  "is scoffing at your persistent begging.",
  "yawns loudly and suggests you go find a real job.",
  "thinks you lack the dignity of a true incarnation.",
  "wonders if you know any skills other than groveling.",
  "is throwing a single dried acorn in your direction.",
  "tells the Dokkaebi to kick this beggar off the channel.",
  "wonders why the Bureau even gave you a broadcast license.",
];

function getRandomConstellationEvent() {
  const con = CONSTELLATIONS[Math.floor(Math.random() * CONSTELLATIONS.length)];
  const msg = con.messages[Math.floor(Math.random() * con.messages.length)];
  return { con, msg };
}

function randomSystemEvent() {
  if (Math.random() < 0.25) {
    const { con, msg } = getRandomConstellationEvent();
    const mods = getStatModifiers();
    const reward = Math.floor(con.reward * (state.coinMultiplier || 1.0) * mods.magicCoinBoost);
    state.coins += reward;
    saveState();
    console.log(
      '\n' +
      c.acc2('[') + c.gold(`Constellation '${con.name}'`) +
      c.acc2('] ') + c.text(msg) +
      c.dim(` (+${reward} Coins)`)
    );
  }
}

// ── 8 Main Scenarios ──────────────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 1,
    name: 'Main Scenario #1 – Proof of Value',
    desc: 'Kill one or more living things (Execute any shell command 3 times).',
    type: 'command',
    requiredCount: 3,
    currentCount: 0,
    rewardCoins: 300,
    fableAward: { name: 'One Who Cheated Death', grade: 'Historical', desc: 'Surviving the first extinction train carriage through unorthodox means.' },
    penalty: 'Immediate termination',
  },
  {
    id: 2,
    name: 'Main Scenario #2 – Escape the Ruins (Gumho Bridge)',
    desc: 'Cross into the adjacent sub-district (Navigate directories using cd 4 times).',
    type: 'cd',
    requiredCount: 4,
    currentCount: 0,
    rewardCoins: 600,
    penalty: '500 Coins fine',
  },
  {
    id: 3,
    name: 'Main Scenario #3 – Emergency Defense (Green Zone)',
    desc: 'Secure sufficient survival capital (Accumulate 7,000 Coins).',
    type: 'coin',
    targetCoins: 7000,
    rewardCoins: 1200,
    penalty: 'Demotion of incarnation rating',
  },
  {
    id: 4,
    name: 'Main Scenario #4 – The King’s Flag',
    desc: 'Proclaim your presence to the Bureau (Switch channels 3 times).',
    type: 'channel',
    requiredCount: 3,
    currentCount: 0,
    rewardCoins: 2000,
    penalty: 'Loss of constellation favor',
  },
  {
    id: 5,
    name: 'Main Scenario #5 – Absolute Throne',
    desc: 'Perform 8 system actions to demonstrate sovereign capability (Run commands or cd).',
    type: 'action',
    requiredCount: 8,
    currentCount: 0,
    rewardCoins: 3500,
    fableAward: { name: 'King of a Kingless World', grade: 'Narrative', desc: 'Shattering the Absolute Throne and proving kings are unnecessary in a ruined world.' },
    penalty: 'Destruction of the throne',
  },
  {
    id: 6,
    name: 'Main Scenario #6 – Abandoned World',
    desc: 'Petition high-tier constellations for intervention (Use sponsor 3 times).',
    type: 'sponsor',
    requiredCount: 3,
    currentCount: 0,
    rewardCoins: 5000,
    penalty: 'Forced incarnation banishment',
  },
  {
    id: 7,
    name: 'Main Scenario #7 – Demon King Selection',
    desc: 'Gather massive coin tribute for the constellation vote (Reach 15,000 Coins).',
    type: 'coin',
    targetCoins: 15000,
    rewardCoins: 8000,
    fableAward: { name: 'Demon King of Salvation', grade: 'Myth', desc: 'Sacrificing oneself to save the companions from catastrophic scenario failure.' },
    penalty: 'Demonization',
  },
  {
    id: 8,
    name: 'Main Scenario #8 – Liberation of Seoul Dome',
    desc: 'Prepare the epilogue (Clear your terminal screen using clear 2 times).',
    type: 'clear',
    requiredCount: 2,
    currentCount: 0,
    rewardCoins: 15000,
    fableAward: { name: 'Season of Light and Darkness', grade: 'Giant Story', desc: 'The monumental tale of piercing through the dome that encased the world.' },
    penalty: 'Permanent scenario loop (Regression)',
  },
];

function checkScenarioProgress(type) {
  const s = SCENARIOS[state.currentScenarioIdx];
  if (!s) return;

  const increment = (state.stigma?.includes('Somersault Cloud') && type === 'cd') ? 2 : 1;

  if (s.type === 'coin' && state.coins >= s.targetCoins) {
    completeScenario(s);
  } else if (s.type === type || (s.type === 'action' && (type === 'command' || type === 'cd'))) {
    s.currentCount += increment;
    if (s.currentCount >= s.requiredCount) completeScenario(s);
  }
}

function completeScenario(s) {
  const mods = getStatModifiers();
  let multiplier = (state.coinMultiplier || 1.0) * mods.magicCoinBoost;
  if (state.sponsor.includes('Reject') || state.sponsor.includes('Independent')) multiplier *= 2;
  else if (state.sponsor.includes('Judge of Fire')) multiplier *= 1.5;

  if (state.favorMilestones['Demon-like Judge of Fire']?.includes(50)) {
    multiplier *= 1.15;
  }

  const earned = Math.floor(s.rewardCoins * multiplier);
  state.coins += earned;
  state.scenariosCleared++;
  state.currentScenarioIdx++;

  adjustFavor('Demon-like Judge of Fire', 8);

  if (s.id === 1 && !state.sponsorUnlocked) {
    state.sponsorUnlocked = true;
  }

  saveState();

  console.log('\n' + c.gold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(c.gold(` [!] SCENARIO CLEARED: ${s.name}`));
  console.log(c.text(' Bounty Claimed: ') + c.gold(`+${earned} Coins!`) + c.text(` (Total: ${state.coins} C)`));
  
  if (s.fableAward) {
    awardFable(s.fableAward.name, s.fableAward.grade, s.fableAward.desc);
  }

  if (s.id === 1 && state.sponsor === 'None (Uncontracted)') {
    console.log('');
    console.log(c.accent(" [The Bureau has declared the first 'Sponsor Selection' open!]"));
    console.log(c.mid(' Type ') + c.gold('contract') + c.mid(' to view interested Constellations and choose your backer.'));
  }
  
  console.log(c.gold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

// ── Header & Banner ───────────────────────────────────────────────────────────
const BANNER = [
  "  ▄▄          ▄▄ ▄▄        ▄▄      ▄▄                                           ",
  "  ██          ██ ██        ██      ██                                           ",
  "  ████▄ ▄█▀█▄ ██ ██ ▄███▄  ██   ▄████ ████▄ ▄█▀█▄  ▀▀█▄ ███▄███▄ ▄█▀█▄ ████▄    ",
  "  ██ ██ ██▄█▀ ██ ██ ██ ██  ▀▀   ██ ██ ██ ▀▀ ██▄█▀ ▄█▀██ ██ ██ ██ ██▄█▀ ██ ▀▀    ",
  "  ██ ██ ▀█▄▄▄ ██ ██ ▀███▀  ██   ▀████ ██    ▀█▄▄▄ ▀█▄██ ██ ██ ██ ▀█▄▄▄ ██    ██ "
];

function printBanner() {
  console.log('');
  BANNER.forEach(line => console.log(c.accent(line)));
  console.log('');
  console.log(
    c.dim('  Terminal UI  ◆  Star Stream Engine  ') +
    c.gold(`[Channel ${state.currentChannel}]`) +
    c.dim('  •  Turn: ') + c.accent(`${state.regressionTurn}`) +
    c.dim('  •  Host: ') + c.text('Bihyung')
  );
  console.log(
    c.dim('  Coins: ') + c.gold(`${state.coins} C`) +
    c.dim('  |  Incarnation: ') + c.accent(state.incarnationName) +
    c.dim('  |  Sponsor: ') + c.gold(state.sponsor)
  );
  console.log('');
  console.log(
    c.dim('  type ') + c.mid('help') +
    c.dim(' · ') + c.mid('guide') +
    c.dim(' · ') + c.mid('status') +
    c.dim(' · ') + c.mid('scenario') +
    c.dim(' · ') + c.mid('shop')
  );
  console.log('');
}

// ── Path & Prompt ─────────────────────────────────────────────────────────────
function shortCwd() {
  const home = os.homedir().replace(/\\/g, '/');
  const p = process.cwd().replace(/\\/g, '/');
  return p.startsWith(home) ? '~' + p.slice(home.length) : p;
}

function getPrompt() {
  const hasDragonAura = state.favorMilestones['Abyssal Black Flame Dragon']?.includes(75);
  let arrow = state.hasUnbrokenFaith ? c.gold('🗡') : c.acc2('›');
  if (hasDragonAura && !state.hasUnbrokenFaith) {
    arrow = fg('#9d4edd', '›');
  }
  return c.accent(shortCwd()) + ' ' + arrow + ' ';
}

// ── Shell Commands ────────────────────────────────────────────────────────────
const builtins = {
  guide(args, cb) {
    console.log('');
    console.log(c.gold('  ╔══════════════════════════════════════════════════════════════════════════╗'));
    console.log(c.gold('  ║            STAR STREAM TERMINAL ENGINE - INCARNATION MANUAL              ║'));
    console.log(c.gold('  ╚══════════════════════════════════════════════════════════════════════════╝\n'));

    console.log(c.accent('  ◆ CORE CONCEPTS'));
    console.log(c.dim('    Progress through 8 Main Scenarios of Seoul Dome by running everyday shell'));
    console.log(c.dim('    commands. Earn coins, sign with a backer, build stats, and assemble Fables.\n'));

    console.log(c.accent('  ◆ KEY COMMANDS'));
    console.log(c.mid('    status           ') + c.dim('Inspect attributes, stats, active relics & fables'));
    console.log(c.mid('    scenario         ') + c.dim('Check current scenario objective, progress & bounty'));
    console.log(c.mid('    contract [1-5]   ') + c.dim('Sign with a Sponsor or walk the Kim Dokja solo route'));
    console.log(c.mid('    favor            ') + c.dim('Check relationship gauges with key Constellations'));
    console.log(c.mid('    shop / buy       ') + c.dim('Visit the Dokkaebi Bag for stat upgrades and relics'));
    console.log(c.mid('    fable recite     ') + c.dim('Recite unlocked stories for instant coin tributes'));
    console.log(c.mid('    sponsor          ') + c.dim('Petition the channel for direct donations (watch cooldowns!)'));
    console.log(c.mid('    regress          ') + c.dim('Loop into the next Turn while keeping all permanent perks\n'));

    console.log(c.accent('  ◆ ACTIVE STATS'));
    console.log(c.dim('    • ') + c.text('Physique : ') + c.dim('Reduces sponsor begging spam cooldowns'));
    console.log(c.dim('    • ') + c.text('Agility  : ') + c.dim('Chance to scavenge bonus coins when running cd'));
    console.log(c.dim('    • ') + c.text('Magic    : ') + c.dim('Scales all incoming coin bounties and tributes\n'));

    console.log(c.accent('  ◆ CONSTELLATION FAVOR'));
    console.log(c.dim('    • ') + c.gold('Uriel (Judge of Fire)    : ') + c.dim('Values clean commands & fable recitations'));
    console.log(c.dim('    • ') + c.gold('Sun Wukong (Golden Headband): ') + c.dim('Values rapid directory traversal (cd)'));
    console.log(c.dim('    • ') + c.gold('Black Flame Dragon       : ') + c.dim('Loves failed commands, ALL CAPS & ! marks'));
    console.log(c.dim('    • ') + c.gold('Secretive Plotter        : ') + c.dim('Rewards reviewing status, favor, fable & info\n'));

    console.log(c.dim('  (A full plain-text guide is available in ') + c.accent('GUIDE.txt') + c.dim(' in this directory.)\n'));
    cb();
  },

  status(args, cb) {
    adjustFavor('Secretive Plotter', 2);

    if (args[0] === 'name') {
      const newName = args.slice(1).join(' ').trim();
      if (!newName) {
        console.log(c.dim('  Usage: status name <new_name>\n'));
        cb();
        return;
      }
      state.incarnationName = newName;
      saveState();
      console.log(c.accent(`\n  [System] Incarnation identity revised to '${state.incarnationName}'.\n`));
      cb();
      return;
    }

    const mods = getStatModifiers();
    console.log('');
    console.log(c.accent('  === [ INCARNATION ATTRIBUTES ] ==='));
    console.log(c.dim('  Name: ') + c.text(state.incarnationName) + c.dim(` [Turn ${state.regressionTurn}]`));
    console.log(c.dim('  Sponsor: ') + c.gold(state.sponsor));
    console.log(c.dim('  Exclusive Stigma: ') + c.acc2(state.stigma));
    console.log(c.dim('  Stigma Effect: ') + c.mid(state.stigmaDesc));
    console.log(
      c.dim('  Overall Stats: ') +
      c.mid(`Physique Lv.${state.stats.physique} (-${mods.cooldownReduction}s CD), `) +
      c.mid(`Agility Lv.${state.stats.agility} (${Math.round(mods.agilityProcChance * 100)}% find rate), `) +
      c.mid(`Magic Lv.${state.stats.magic} (+${Math.round((mods.magicCoinBoost - 1) * 100)}% yield)`)
    );
    console.log(c.dim('  Coins Possessed: ') + c.gold(`${state.coins} C`) + c.dim(` (Base Multiplier: ${state.coinMultiplier}x)`));
    console.log(c.dim('  Active Relics: ') + c.text(state.hasUnbrokenFaith ? '[Unbroken Faith (Ether Blade Equipped)]' : 'None'));
    console.log(c.dim('  Scenarios Cleared: ') + c.text(`${state.scenariosCleared}`));
    console.log(c.dim('  Recorded Fables: ') + c.text(`${state.fables.map(f => f.name).join(', ')}`));
    console.log('');
    cb();
  },

  favor(args, cb) {
    adjustFavor('Secretive Plotter', 2);
    console.log('');
    console.log(c.gold('  === [ CONSTELLATION FAVORABILITY ] ==='));
    console.log(c.dim('  How closely the cosmic viewers are aligned with your narrative:\n'));

    Object.entries(state.favor).forEach(([name, val]) => {
      const barFilled = '■'.repeat(Math.floor(val / 10));
      const barEmpty = '·'.repeat(10 - Math.floor(val / 10));
      const bar = c.gold(barFilled) + c.dim(barEmpty);
      const mCount = state.favorMilestones[name]?.length || 0;
      console.log(`  ${c.accent(name.padEnd(35))} [${bar}] ${c.text(val + '%')} ${c.dim(`(${mCount}/4 perks)`)}`);
    });
    console.log('');
    cb();
  },

  shop(args, cb) {
    console.log('');
    console.log(c.gold('  === [ THE DOKKAEBI BAG ] ==='));
    console.log(c.dim('  Bihyung smirks: "Got enough coins to back up that curiosity?"\n'));

    const items = [
      ['potion',  'Ellain Forest Fluid',    500,  'Instantly resets sponsor begging cooldown'],
      ['essence', 'White Star Essence',     2500, 'Permanently increases all coin yields by +25%'],
      ['blade',   'Unbroken Faith',         4000, 'Transforms prompt into celestial ether blade 🗡'],
      ['stat-p',  'Physique Training +5',   1000, 'Increases Physique Lv by 5 (Lowers CD)'],
      ['stat-a',  'Agility Training +5',    1000, 'Increases Agility Lv by 5 (Boosts cd find rate)'],
      ['stat-m',  'Magic Training +5',      1000, 'Increases Magic Lv by 5 (Boosts coin yield)'],
    ];

    items.forEach(([code, name, cost, desc]) => {
      console.log(`  ` + c.accent(code.padEnd(8)) + c.gold(`${cost} C`.padEnd(10)) + c.text(name.padEnd(25)) + c.dim(desc));
    });

    console.log(c.dim('\n  Purchase with: ') + c.mid('buy <code>\n'));
    cb();
  },

  buy(args, cb) {
    const code = (args[0] || '').toLowerCase();
    const prices = {
      'potion': 500,
      'essence': 2500,
      'blade': 4000,
      'stat-p': 1000,
      'stat-a': 1000,
      'stat-m': 1000,
    };

    if (!prices[code]) {
      console.log(c.acc2(`\n  Invalid item code. Type 'shop' to browse the Dokkaebi Bag.\n`));
      cb();
      return;
    }

    if (state.coins < prices[code]) {
      console.log(c.acc2(`\n  Insufficient coins! You need ${prices[code]} C but only possess ${state.coins} C.\n`));
      cb();
      return;
    }

    state.coins -= prices[code];

    if (code === 'potion') {
      state.cooldownUntil = 0;
      state.sponsorCount = 0;
      console.log(c.accent('\n  [!] Drank Ellain Forest Fluid. All sponsor cooldowns have been wiped clean!'));
    } else if (code === 'essence') {
      state.coinMultiplier = parseFloat((state.coinMultiplier + 0.25).toFixed(2));
      console.log(c.gold(`\n  [!] Absorbed White Star Essence. Base coin multiplier is now ${state.coinMultiplier}x!`));
    } else if (code === 'blade') {
      state.hasUnbrokenFaith = true;
      console.log(c.gold(`\n  [!] Bound Relic: 'Unbroken Faith'. Your terminal prompt now radiates ether energy!`));
    } else if (code === 'stat-p') {
      state.stats.physique += 5;
      console.log(c.accent(`\n  [!] Physique increased to Lv.${state.stats.physique}!`));
    } else if (code === 'stat-a') {
      state.stats.agility += 5;
      console.log(c.accent(`\n  [!] Agility increased to Lv.${state.stats.agility}!`));
    } else if (code === 'stat-m') {
      state.stats.magic += 5;
      console.log(c.accent(`\n  [!] Magic increased to Lv.${state.stats.magic}!`));
    }

    saveState();
    console.log(c.dim(`  Remaining Balance: ${state.coins} C\n`));
    cb();
  },

  regress(args, cb) {
    console.log('');
    console.log(c.acc2('  [!] INITIATING REGRESSION TRANSMISSION...'));
    console.log(c.dim('  "Tell me, Yoo Joonghyuk... will the next turn bring a different end?"\n'));

    setTimeout(() => {
      state.regressionTurn++;
      state.currentScenarioIdx = 0;
      state.coins = 5000;
      state.sponsorCount = 0;
      state.cooldownUntil = 0;

      saveState();

      console.clear();
      printBanner();
      console.log(c.gold(`  [REGRESSION SUCCESSFUL: Commenced Turn ${state.regressionTurn}]`));
      console.log(c.dim(`  Stats, Favor, and Fables retained. Scenarios reset to Main Scenario #1.\n`));
      cb();
    }, 1200);
  },

  scenario(args, cb) {
    adjustFavor('Secretive Plotter', 2);
    const s = SCENARIOS[state.currentScenarioIdx];
    console.log('');
    console.log(c.gold('  === [ ACTIVE MAIN SCENARIO ] ==='));
    if (!s) {
      console.log(c.accent('  All recorded scenarios for Seoul Dome are cleared!'));
      console.log(c.dim('  Wait for the Bureau to open the next planetary scenario.\n'));
      cb();
      return;
    }
    console.log(c.accent('  Title: ') + c.text(s.name));
    console.log(c.accent('  Objective: ') + c.text(s.desc));
    if (s.requiredCount) {
      console.log(c.dim('  Progress: ') + c.gold(`${s.currentCount} / ${s.requiredCount}`));
    } else if (s.targetCoins) {
      console.log(c.dim('  Progress: ') + c.gold(`${state.coins} / ${s.targetCoins} C`));
    }
    console.log(c.accent('  Bounty: ') + c.gold(`+${s.rewardCoins} Coins`));
    console.log(c.dim('  Penalty for Failure: ') + c.acc2(s.penalty));
    console.log('');
    cb();
  },

  contract(args, cb) {
    if (!state.sponsorUnlocked && state.scenariosCleared < 1) {
      console.log(c.acc2('\n  [!] Sponsor Selection is locked.'));
      console.log(c.dim('  Clear Main Scenario #1 first to prove your worth to the Constellations.\n'));
      cb();
      return;
    }

    const SPONSOR_CANDIDATES = [
      { id: 1, name: 'Demon-like Judge of Fire', stigma: 'Flames of Retribution Lv.1', perk: '+50% Coin reward on scenario clears & high coin donations.', code: 'uriel' },
      { id: 2, name: 'Prisoner of the Golden Headband', stigma: 'Somersault Agile Step Lv.1', perk: 'Doubles directory agility & cuts begging cooldown by 50%.', code: 'wukong' },
      { id: 3, name: 'Abyssal Black Flame Dragon', stigma: 'Black Flame Ignition Lv.1', perk: 'Gains 300 Coins whenever a command errors or terminates unexpectedly.', code: 'dragon' },
      { id: 4, name: 'Secretive Plotter', stigma: 'Reader Divergence Lv.1', perk: 'Silently awards coins in the background during navigation.', code: 'plotter' },
      { id: 5, name: 'Reject All Sponsors (Kim Dokja Route)', stigma: "Omniscient Reader's Viewpoint Lv.3", perk: 'Remain independent. Earn double bounty multipliers on all major scenarios.', code: 'none' }
    ];

    const choice = (args[0] || '').trim();
    if (!choice) {
      console.log('');
      console.log(c.gold('  === [ THE STAR STREAM SPONSOR SELECTION ] ==='));
      console.log(c.dim('  Choose your backer by running: ') + c.mid('contract <number>') + '\n');

      SPONSOR_CANDIDATES.forEach(item => {
        console.log(c.gold(`  [${item.id}] `) + c.accent(item.name));
        console.log(c.dim('      Stigma: ') + c.acc2(item.stigma));
        console.log(c.dim('      Perk:   ') + c.text(item.perk));
        console.log('');
      });
      cb();
      return;
    }

    const selected = SPONSOR_CANDIDATES.find(item => item.id.toString() === choice || item.code === choice.toLowerCase());
    if (!selected) {
      console.log(c.acc2(`\n  Invalid selection. Choose between 1 and ${SPONSOR_CANDIDATES.length}.\n`));
      cb();
      return;
    }

    state.sponsor = selected.name;
    state.stigma = selected.stigma;
    state.stigmaDesc = selected.perk;

    if (selected.id === 5) {
      adjustFavor('Demon-like Judge of Fire', -10);
      adjustFavor('Secretive Plotter', 20);
      awardFable('He Who Despised the Heavens', 'Historical', 'An Incarnation who arrogantly refused every hand offered by the stars.');
    } else {
      adjustFavor(selected.name, 35);
    }

    saveState();

    console.log('\n' + c.gold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    if (selected.id === 5) {
      console.log(c.gold('  [You have turned your back on the Constellations!]'));
      console.log(c.text('  "I will reach the ■■ with my own story."'));
      console.log(c.acc2("  Unlocked: Omniscient Reader's Viewpoint Lv.3 (2x Scenario Bounties)"));
    } else {
      console.log(c.gold(`  [Contract Established with '${selected.name}'!]`));
      console.log(c.text('  You have inherited the stigma: ') + c.acc2(selected.stigma));
      console.log(c.dim(`  ${selected.perk}`));
    }
    console.log(c.gold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    cb();
  },

  fable(args, cb) {
    adjustFavor('Secretive Plotter', 2);
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'recite') {
      if (state.fables.length === 0) {
        console.log(c.dim('\n  You have no fables to recite yet.\n'));
        cb();
        return;
      }
      const mods = getStatModifiers();
      const target = state.fables[Math.floor(Math.random() * state.fables.length)];
      const tribute = Math.floor((150 + Math.random() * 250) * (state.coinMultiplier || 1.0) * mods.magicCoinBoost);
      state.coins += tribute;
      adjustFavor('Demon-like Judge of Fire', 3);
      saveState();

      console.log('\n' + c.accent(`  [The Fable '${target.name}' begins its storytelling!]`));
      console.log(c.dim(`  « ${target.desc} »`));
      console.log(c.text('  The channel quiets down as your tale echoes across the Star Stream.'));
      console.log(c.gold(`  [Constellations are mesmerized by your narrative! (+${tribute} Coins)]\n`));
      cb();
      return;
    }

    console.log('');
    console.log(c.gold('  === [ INCARNATION FABLE ARCHIVE ] ==='));
    console.log(c.dim('  Total Stories Acquired: ') + c.text(`${state.fables.length}`));
    console.log(c.dim('  Type ') + c.mid('fable recite') + c.dim(' to channel a story.\n'));

    state.fables.forEach(f => {
      const gradeColor = f.grade === 'Giant Story' ? c.gold : f.grade === 'Myth' ? c.accent : f.grade === 'Narrative' ? c.acc2 : c.text;
      console.log(`  ◆ ` + gradeColor(`[${f.grade}] `) + c.accent(f.name) + c.dim(` (${f.unlockedAt})`));
      console.log(c.dim(`    "${f.desc}"`));
      console.log('');
    });
    cb();
  },

  sponsor(args, cb) {
    const now = Date.now();

    if (state.cooldownUntil && now < state.cooldownUntil) {
      const remainingSec = Math.ceil((state.cooldownUntil - now) / 1000);
      console.log(
        '\n' +
        c.acc2('  [') + c.gold("Constellation 'Prisoner of the Golden Headband'") +
        c.acc2('] ') + c.text('is waving his hands dismissively: "Stop spamming the channel!"') +
        c.dim(` (${remainingSec}s cooldown remaining)\n`)
      );
      cb();
      return;
    }

    if (now - state.lastSponsorTime > 30000) {
      state.sponsorCount = 0;
    }

    state.lastSponsorTime = now;
    state.sponsorCount++;
    state.totalSponsorsAttempted = (state.totalSponsorsAttempted || 0) + 1;

    if (state.totalSponsorsAttempted >= 10) {
      awardFable('Comrade in Ruin', 'Narrative', 'An Incarnation whose endless shameless begging became known to the cosmos.');
    }

    saveState();

    console.log(c.dim('\n  Sending a plea across the Star Stream channel...'));

    setTimeout(() => {
      const mods = getStatModifiers();

      if (state.sponsorCount >= 5) {
        let cdSec = Math.floor(Math.random() * 6) + 5 - mods.cooldownReduction;
        if (state.sponsor.includes('Golden Headband')) cdSec = Math.floor(cdSec / 2);
        cdSec = Math.max(3, cdSec);

        state.cooldownUntil = Date.now() + (cdSec * 1000);
        state.sponsorCount = 0;
        adjustFavor('Demon-like Judge of Fire', -2);
        saveState();

        const { con } = getRandomConstellationEvent();
        const mock = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];

        console.log(
          c.acc2('  [') + c.gold(`Constellation '${con.name}'`) +
          c.acc2('] ') + c.text(mock) +
          c.dim(' (0 Coins)')
        );
        console.log(c.dim(`  [The Constellations are sick of your begging. Cooldown: ${cdSec}s]\n`));
        cb();
        return;
      }

      const { con, msg } = getRandomConstellationEvent();
      let reward = Math.floor(con.reward * (state.coinMultiplier || 1.0) * mods.magicCoinBoost);
      if (state.sponsor.includes('Judge of Fire')) reward += 150;

      state.coins += reward;
      saveState();

      checkScenarioProgress('sponsor');
      checkScenarioProgress('coin');

      console.log(
        c.acc2('  [') + c.gold(`Constellation '${con.name}'`) +
        c.acc2('] ') + c.text(msg) +
        c.dim(` (+${reward} Coins)\n`)
      );
      cb();
    }, 450);
  },

  channel(args, cb) {
    const id = (args[0] || `#BI-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();
    state.currentChannel = id;
    saveState();

    const channelHosts = ['Bihyung', 'Biryu', 'Gildong', 'Youngki', 'Doman', 'Baram'];
    const host = channelHosts[Math.floor(Math.random() * channelHosts.length)];
    const viewers = Math.floor(120 + Math.random() * 2400);

    console.log(c.accent(`\n  [Switched broadcast frequency to ${id}]`));
    console.log(c.dim('  Host Dokkaebi: ') + c.gold(host) + c.dim('  |  Watching Constellations: ') + c.accent(`${viewers}`));

    const events = [
      `Dokkaebi ${host} narrows their eyes: "Another incarnation wandered into my channel?"`,
      `[Several Constellations are currently complaining about the boring broadcast pacing.]`,
      `[Constellation 'Demon-like Judge of Fire' is welcoming you to channel ${id}!]`,
      `A loud broadcast chime rings out as low-grade Dokkaebis prepare a bounty list.`,
      `[Constellation 'Secretive Plotter' has silently entered channel ${id}.]`,
      `[Constellation 'Most Ancient Liberator' is demanding you do a somersault.]`,
      `[Constellation 'Demon King of Salvation' quietly observes channel ${id}.]`,
    ];
    console.log(c.mid(`  ${events[Math.floor(Math.random() * events.length)]}\n`));

    checkScenarioProgress('channel');
    cb();
  },

  cd(args, cb) {
    const target = args[0] || os.homedir();
    try {
      process.chdir(path.resolve(process.cwd(), target));
      checkScenarioProgress('cd');
      adjustFavor('Prisoner of the Golden Headband', 2);

      const mods = getStatModifiers();

      if (Math.random() < mods.agilityProcChance) {
        const bonus = Math.floor(25 * mods.magicCoinBoost);
        state.coins += bonus;
        saveState();
        console.log(c.dim(`  [Agile Footwork] Salvaged +${bonus} Coins from the terrain.`));
      }

      const plotterChance = state.favorMilestones['Secretive Plotter']?.includes(50) ? 0.70 : 0.35;
      if (state.sponsor.includes('Secretive Plotter') && Math.random() < plotterChance) {
        const stealthBonus = state.favorMilestones['Secretive Plotter']?.includes(50) ? 50 : 25;
        state.coins += stealthBonus;
        saveState();
      }
    } catch (e) {
      console.log(c.acc2('  [System Warning] ') + c.text(e.message));
    }
    cb();
  },

  clear(args, cb) {
    console.clear();
    printBanner();
    checkScenarioProgress('clear');
    cb();
  },

  theme(args, cb) {
    const name = (args[0] || '').toLowerCase();
    if (!name) {
      console.log('\n' + c.accent('  Available themes:'));
      Object.keys(THEMES).forEach(t => {
        const marker = t === currentTheme ? c.accent('  ● ') : c.dim('  ○ ');
        console.log(marker + (t === currentTheme ? c.accent(t) : c.mid(t)));
      });
      console.log(c.dim('  usage: theme <name>\n'));
      cb();
      return;
    }
    if (!applyTheme(name)) {
      console.log(c.acc2(`\n  theme: unknown theme "${name}".\n`));
      cb();
      return;
    }
    console.clear();
    printBanner();
    console.log(c.accent(`  ◆ theme switched to ${name}\n`));
    cb();
  },

  help(args, cb) {
    [
      '',
      c.accent('  Star Stream System Commands'),
      c.dim('  ────────────────────────────────────────────────'),
      c.mid('  guide                  ') + c.dim('open full incarnation manual & game rules'),
      c.mid('  status                 ') + c.dim('view attributes, fables, relics & stats'),
      c.mid('  scenario               ') + c.dim('view active scenario objective & bounty'),
      c.mid('  shop                   ') + c.dim('browse the Dokkaebi Bag for stats & relics'),
      c.mid('  buy <code>             ') + c.dim('purchase items with earned coins'),
      c.mid('  favor                  ') + c.dim('check Constellation favorability gauges'),
      c.mid('  fable recite           ') + c.dim('channel a fable to earn coin tribute'),
      c.mid('  contract [1-5]         ') + c.dim('choose your sponsor & unlock stigma'),
      c.mid('  regress                ') + c.dim('commence the next regression turn'),
      c.mid('  channel <id>           ') + c.dim('switch channel frequency'),
      c.mid('  sponsor                ') + c.dim('petition constellations for coins'),
      c.mid('  theme <name>           ') + c.dim('switch palette'),
      c.mid('  clear                  ') + c.dim('wipe screen and redraw banner'),
      c.mid('  exit / quit            ') + c.dim('terminate Star Stream link'),
      '',
    ].forEach(l => console.log(l));
    cb();
  },

  exit() {
    console.log(c.dim('\n[The Star Stream broadcast has ended.]\n'));
    process.exit(0);
  },
  quit() { builtins.exit(); },
};

// ── Output Highlighter ────────────────────────────────────────────────────────
function colorizeLine(line) {
  return line
    .replace(/(\[.*?\])/g, m => c.acc2(m))
    .replace(/(<DIR>)/g, c.accent('<DIR>'))
    .replace(/(\b\d+ coins?\b)/gi, m => c.gold(m));
}

// ── Tab Autocompletion ────────────────────────────────────────────────────────
function completer(line) {
  const parts = line.split(' ');
  const word = parts[parts.length - 1];

  if (parts.length === 1) {
    const hits = Object.keys(builtins).filter(k => k.startsWith(word));
    return [hits.length ? hits : Object.keys(builtins), word];
  }

  const baseDir = word.includes(path.sep) || word.includes('/')
    ? path.resolve(process.cwd(), path.dirname(word))
    : process.cwd();

  const filePrefix = path.basename(word);

  try {
    const entries = fs.readdirSync(baseDir);
    const hits = entries.filter(e => e.toLowerCase().startsWith(filePrefix.toLowerCase()));
    return [hits.map(h => path.join(path.dirname(word), h)), word];
  } catch (e) {
    return [[], word];
  }
}

// ── Main Shell Loop ───────────────────────────────────────────────────────────
console.clear();
printBanner();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: getPrompt(),
  completer,
});

rl.prompt();

rl.on('line', line => {
  const trimmed = line.trim();
  if (!trimmed) {
    rl.setPrompt(getPrompt());
    rl.prompt();
    return;
  }

  const [cmd, ...args] = trimmed.split(/\s+/);
  const lowerCmd = cmd.toLowerCase();

  // Favor triggers based on typing style
  if (trimmed.includes('!') || (trimmed === trimmed.toUpperCase() && trimmed.length > 3)) {
    adjustFavor('Abyssal Black Flame Dragon', 2);
  }

  // Run internal game command
  if (builtins[lowerCmd]) {
    builtins[lowerCmd](args, () => {
      rl.setPrompt(getPrompt());
      rl.prompt();
    });
    return;
  }

  // Shell execution
  const WIN_ALIASES = { ls: 'dir', cat: 'type', pwd: 'cd', grep: 'findstr' };
  const execCmd = (IS_WIN && WIN_ALIASES[lowerCmd]) ? trimmed.replace(cmd, WIN_ALIASES[lowerCmd]) : trimmed;

  rl.pause();

  const child = spawn(execCmd, {
    cwd: process.cwd(),
    env: process.env,
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  child.stdout.on('data', d => {
    d.toString().split('\n').forEach(l => {
      if (l) console.log(colorizeLine(l));
    });
  });

  child.stderr.on('data', d => {
    process.stderr.write(c.acc2(d.toString()));
  });

  child.on('close', code => {
    if (code !== 0 && code !== null) {
      triggerFourthWall('error');
      adjustFavor('Abyssal Black Flame Dragon', 4);
      adjustFavor('Demon-like Judge of Fire', -1);

      const isBoosted = state.favorMilestones['Abyssal Black Flame Dragon']?.includes(50);
      const isApocalypse = state.stigma?.includes('Apocalypse Ignition');
      let failBounty = isApocalypse ? 1500 : (isBoosted ? 600 : 300);

      if (state.sponsor.includes('Black Flame') || isApocalypse) {
        state.coins += failBounty;
        saveState();
        console.log(c.acc2(`  [Constellation 'Abyssal Black Flame Dragon' enjoys the destruction!] (+${failBounty} Coins)`));
      }
    } else {
      adjustFavor('Demon-like Judge of Fire', 1);
      checkScenarioProgress('command');
      randomSystemEvent();
    }
    rl.resume();
    rl.setPrompt(getPrompt());
    rl.prompt();
  });
});

rl.on('close', () => {
  builtins.exit();
});