/* =============================================================================
   Static game data: generators, upgrades, shard shop, achievements.
   Balance follows the classic geometric curve (cost x1.15 per purchase) which
   keeps every tier relevant for roughly the same amount of play time.
   ========================================================================== */
(function (global) {
  'use strict';

  var COST_GROWTH = 1.15;

  var GENERATORS = [
    { id: 'scrapper',  name: 'Nano Scrapper',   desc: 'Chews through debris one atom at a time.',        cost: 15,      rate: 0.1 },
    { id: 'drone',     name: 'Drone Swarm',     desc: 'A hundred tiny hands, no complaints.',            cost: 100,     rate: 1 },
    { id: 'smelter',   name: 'Arc Smelter',     desc: 'Melts scrap into something worth having.',        cost: 1.1e3,   rate: 8 },
    { id: 'fab',       name: 'Fabricator',      desc: 'Prints matter from a blueprint you stole.',       cost: 12e3,    rate: 47 },
    { id: 'line',      name: 'Assembly Line',   desc: 'Industrial-grade patience.',                      cost: 130e3,   rate: 260 },
    { id: 'replicator',name: 'Replicator',      desc: 'Copies itself. Legally grey.',                    cost: 1.4e6,   rate: 1400 },
    { id: 'fusion',    name: 'Fusion Plant',    desc: 'A small star in a very strong box.',              cost: 20e6,    rate: 7800 },
    { id: 'quantum',   name: 'Quantum Foundry', desc: 'Builds in every timeline, bills you in one.',     cost: 330e6,   rate: 44e3 },
    { id: 'dyson',     name: 'Dyson Lattice',   desc: 'Wraps a sun. The sun has opinions.',              cost: 5.1e9,   rate: 260e3 },
    { id: 'core',      name: 'Singularity Core',desc: 'Matter falls in. More matter falls out.',         cost: 75e9,    rate: 1.6e6 }
  ];

  // Per-generator milestone multipliers. Owning 10 doubles it, 25 doubles
  // again, and so on — the reason to keep buying a "dead" early tier.
  var MILESTONES = [
    { at: 10,   mult: 2 },
    { at: 25,   mult: 2 },
    { at: 50,   mult: 2 },
    { at: 100,  mult: 3 },
    { at: 200,  mult: 3 },
    { at: 350,  mult: 4 }
  ];

  /* ------------------------------------------------------------- upgrades -- */
  // kind: 'global' (multiply all production), 'gen' (multiply one generator),
  //       'click' (multiply click power), 'clickFromRate' (click scales w/ rate)
  var UPGRADES = [
    { id: 'u_hands',   name: 'Reinforced Gloves', cost: 100,    kind: 'click',  mult: 2,
      desc: 'Click power x2.', req: { clicks: 10 } },
    { id: 'u_scr1',    name: 'Sharper Jaws',      cost: 500,    kind: 'gen', gen: 'scrapper', mult: 2,
      desc: 'Nano Scrappers x2.', req: { owned: { scrapper: 10 } } },
    { id: 'u_drone1',  name: 'Swarm Protocol',    cost: 3e3,    kind: 'gen', gen: 'drone', mult: 2,
      desc: 'Drone Swarms x2.', req: { owned: { drone: 10 } } },
    { id: 'u_global1', name: 'Lean Logistics',    cost: 10e3,   kind: 'global', mult: 1.25,
      desc: 'All production x1.25.', req: { total: 5e3 } },
    { id: 'u_click2',  name: 'Kinetic Amplifier', cost: 25e3,   kind: 'clickFromRate', pct: 0.02,
      desc: 'Clicks also grant 2% of production per second.', req: { clicks: 250 } },
    { id: 'u_smelt1',  name: 'Plasma Liner',      cost: 40e3,   kind: 'gen', gen: 'smelter', mult: 2,
      desc: 'Arc Smelters x2.', req: { owned: { smelter: 10 } } },
    { id: 'u_fab1',    name: 'Recursive Molds',   cost: 250e3,  kind: 'gen', gen: 'fab', mult: 2,
      desc: 'Fabricators x2.', req: { owned: { fab: 10 } } },
    { id: 'u_global2', name: 'Just-In-Time Feed', cost: 1e6,    kind: 'global', mult: 1.5,
      desc: 'All production x1.5.', req: { total: 500e3 } },
    { id: 'u_line1',   name: 'Night Shift',       cost: 3e6,    kind: 'gen', gen: 'line', mult: 2,
      desc: 'Assembly Lines x2.', req: { owned: { line: 10 } } },
    { id: 'u_click3',  name: 'Graviton Stylus',   cost: 8e6,    kind: 'clickFromRate', pct: 0.08,
      desc: 'Clicks grant a further 8% of production per second.', req: { clicks: 1000 } },
    { id: 'u_rep1',    name: 'Clean Copies',      cost: 25e6,   kind: 'gen', gen: 'replicator', mult: 2,
      desc: 'Replicators x2.', req: { owned: { replicator: 10 } } },
    { id: 'u_global3', name: 'Vertical Monopoly', cost: 100e6,  kind: 'global', mult: 2,
      desc: 'All production x2.', req: { total: 50e6 } },
    { id: 'u_fus1',    name: 'Magnetic Pinch',    cost: 400e6,  kind: 'gen', gen: 'fusion', mult: 2,
      desc: 'Fusion Plants x2.', req: { owned: { fusion: 10 } } },
    { id: 'u_qua1',    name: 'Decoherence Damper',cost: 3e9,    kind: 'gen', gen: 'quantum', mult: 2,
      desc: 'Quantum Foundries x2.', req: { owned: { quantum: 10 } } },
    { id: 'u_global4', name: 'Planetary Contract',cost: 20e9,   kind: 'global', mult: 2,
      desc: 'All production x2.', req: { total: 5e9 } },
    { id: 'u_dys1',    name: 'Mirror Bloom',      cost: 80e9,   kind: 'gen', gen: 'dyson', mult: 2,
      desc: 'Dyson Lattices x2.', req: { owned: { dyson: 10 } } },
    { id: 'u_core1',   name: 'Event Horizon Tap', cost: 750e9,  kind: 'gen', gen: 'core', mult: 2,
      desc: 'Singularity Cores x2.', req: { owned: { core: 10 } } },
    { id: 'u_global5', name: 'Galactic Charter',  cost: 5e12,   kind: 'global', mult: 3,
      desc: 'All production x3.', req: { total: 1e12 } }
  ];

  /* ---------------------------------------------------------- shard shop -- */
  // Permanent, survives every Collapse. Bought with Singularity Shards.
  var SHARD_SHOP = [
    { id: 's_auto',    name: 'Autonomous Arms',  cost: 3,  max: 1,
      desc: 'Auto-clicks 5 times per second, forever.' },
    { id: 's_click',   name: 'Fractal Fingers',  cost: 5,  max: 5,
      desc: 'Click power x3 per level.' },
    { id: 's_prod',    name: 'Dense Reality',    cost: 8,  max: 10,
      desc: 'All production x1.5 per level.' },
    { id: 's_offline', name: 'Cold Storage',     cost: 6,  max: 4,
      desc: 'Offline cap +4h per level (base 8h).' },
    { id: 's_head',    name: 'Head Start',       cost: 12, max: 3,
      desc: 'Begin each run with 5 of the first N generator tiers, per level.' },
    { id: 's_shard',   name: 'Shard Resonance',  cost: 20, max: 5,
      desc: 'Earn 25% more shards per Collapse, per level.' }
  ];

  /* -------------------------------------------------------- achievements -- */
  // Each one earned adds +1% to all production — a quiet completion reward.
  var ACHIEVEMENTS = [
    { id: 'a_click1',  name: 'First Contact',    desc: 'Click once.',                   test: function (s) { return s.stats.clicks >= 1; } },
    { id: 'a_click100',name: 'Repetitive Strain',desc: 'Click 100 times.',              test: function (s) { return s.stats.clicks >= 100; } },
    { id: 'a_click1k', name: 'Carpal Tunnel',    desc: 'Click 1,000 times.',            test: function (s) { return s.stats.clicks >= 1000; } },
    { id: 'a_m1k',     name: 'Pocket Change',    desc: 'Earn 1,000 matter.',            test: function (s) { return s.stats.totalEarned >= 1e3; } },
    { id: 'a_m1m',     name: 'Industrialist',    desc: 'Earn 1 million matter.',        test: function (s) { return s.stats.totalEarned >= 1e6; } },
    { id: 'a_m1b',     name: 'Tycoon',           desc: 'Earn 1 billion matter.',        test: function (s) { return s.stats.totalEarned >= 1e9; } },
    { id: 'a_m1t',     name: 'Planet Eater',     desc: 'Earn 1 trillion matter.',       test: function (s) { return s.stats.totalEarned >= 1e12; } },
    { id: 'a_m1qa',    name: 'Local Deity',      desc: 'Earn 1 quadrillion matter.',    test: function (s) { return s.stats.totalEarned >= 1e15; } },
    { id: 'a_first',   name: 'Delegation',       desc: 'Buy your first generator.',     test: function (s) { return s.stats.bought >= 1; } },
    { id: 'a_b100',    name: 'Middle Management',desc: 'Own 100 generators total.',     test: function (s) { return totalOwned(s) >= 100; } },
    { id: 'a_b500',    name: 'Board of Directors',desc:'Own 500 generators total.',     test: function (s) { return totalOwned(s) >= 500; } },
    { id: 'a_ten',     name: 'Round Numbers',    desc: 'Own 10 of one generator.',      test: function (s) { return anyOwned(s, 10); } },
    { id: 'a_fifty',   name: 'Assembly Required',desc: 'Own 50 of one generator.',      test: function (s) { return anyOwned(s, 50); } },
    { id: 'a_hundred', name: 'Overkill',         desc: 'Own 100 of one generator.',     test: function (s) { return anyOwned(s, 100); } },
    { id: 'a_allgen',  name: 'Full Catalogue',   desc: 'Own at least one of every generator.',
      test: function (s) { return GENERATORS.every(function (g) { return (s.gens[g.id] || 0) > 0; }); } },
    { id: 'a_up5',     name: 'Tinkerer',         desc: 'Buy 5 upgrades.',               test: function (s) { return s.upgrades.length >= 5; } },
    { id: 'a_up12',    name: 'Engineer',         desc: 'Buy 12 upgrades.',              test: function (s) { return s.upgrades.length >= 12; } },
    { id: 'a_rate1m',  name: 'Hands Free',       desc: 'Reach 1M matter per second.',   test: function (s, rate) { return rate >= 1e6; } },
    { id: 'a_collapse1',name:'Try Again',        desc: 'Collapse once.',                test: function (s) { return s.stats.collapses >= 1; } },
    { id: 'a_collapse5',name:'Groundhog',        desc: 'Collapse 5 times.',             test: function (s) { return s.stats.collapses >= 5; } },
    { id: 'a_shard25', name: 'Shard Hoarder',    desc: 'Hold 25 shards at once.',       test: function (s) { return s.shards >= 25; } },
    { id: 'a_boost',   name: 'Overclocked',      desc: 'Run Overdrive once.',           test: function (s) { return s.stats.boosts >= 1; } },
    { id: 'a_offline', name: 'Touched Grass',    desc: 'Claim offline earnings.',       test: function (s) { return s.stats.offlineClaims >= 1; } },
    { id: 'a_daily',   name: 'Regular',          desc: 'Claim a daily bonus.',          test: function (s) { return s.stats.dailyClaims >= 1; } }
  ];

  function totalOwned(s) {
    return GENERATORS.reduce(function (a, g) { return a + (s.gens[g.id] || 0); }, 0);
  }
  function anyOwned(s, n) {
    return GENERATORS.some(function (g) { return (s.gens[g.id] || 0) >= n; });
  }

  global.DATA = {
    COST_GROWTH: COST_GROWTH,
    GENERATORS: GENERATORS,
    MILESTONES: MILESTONES,
    UPGRADES: UPGRADES,
    SHARD_SHOP: SHARD_SHOP,
    ACHIEVEMENTS: ACHIEVEMENTS
  };
})(window);
