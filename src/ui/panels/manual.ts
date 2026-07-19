// Colony Manual — the in-game player guide. Static, authored prose split into
// sections with a contents rail down the left. Numbers here are transcribed from
// data/constants.ts and data/buildings.ts; if you retune a constant, update the
// matching line below (there is no runtime binding — deliberately, so the manual
// reads as prose rather than a stat dump).

import type { UIContext } from '../context';
import { el, elHtml, button } from '../dom';
import { openPanel } from '../panels';

interface Section {
  id: string;
  title: string;
  html: string;
}

const SECTIONS: Section[] = [
  {
    id: 'start',
    title: 'Getting started',
    html: `
      <p>You command a colony on a hostile world. Earth pays a <b>Colony Support Grant</b>
      &mdash; 3,000 GR/month for the first three years, 1,500 for years four and five,
      then nothing. By then the colony must pay for itself.</p>

      <p>Everything runs on a <b>day/month tick</b>: 30 days to the month, one real second
      per day at 1&times;. Production, wages, food, air, research and trade are all settled
      on the <b>monthly</b> tick &mdash; so a decision made today shows up at month end.</p>

      <h4>The first year, in order</h4>
      <ol>
        <li><b>Flux Pod</b> &mdash; defines a 12-tile build radius. Nothing can be built
        outside one, so this is always the first structure.</li>
        <li><b>Power Station</b> (50 MW) &mdash; nearly every building draws power, and an
        unpowered building simply stops working.</li>
        <li><b>Living Quarters</b> &mdash; 50 colonists each. Population above your housing
        capacity will not grow.</li>
        <li><b>Hydroponics</b> (feeds 100) and <b>Life Support</b> (air for 400).
        Starvation kills 8% of the colony a month; suffocation kills 15%.</li>
        <li><b>Mine</b> and <b>Chemical Plant</b> on ore and fuel deposits &mdash; your
        only real income once the grant tapers off.</li>
        <li><b>Command Centre</b> &mdash; required before you can trade, build ship or tank
        yards, or attack the alien city.</li>
      </ol>

      <p class="u-hint">Deposits are only revealed within 6 tiles of one of your buildings,
      so early exploration is really just building outward.</p>`,
  },
  {
    id: 'survival',
    title: 'Power &amp; survival',
    html: `
      <p>Power is the master constraint. Each month the colony totals its generation
      (Power Station 50 MW, Solar Panel 2 MW, Solar Generator 4 MW &mdash; solar produces
      <b>nothing</b> during an eclipse) and compares it to demand.</p>

      <p>If demand exceeds supply, buildings are <b>shed in a fixed order</b> until the
      books balance. This order matters enormously and catches people out:</p>

      <div class="u-man-shed">
        <span>Workshop</span><span>Arms Lab</span><span>Sports Complex</span>
        <span>Tank Yard</span><span>Ship Yard</span><span>Mine</span>
        <span>Chemical Plant</span><span>Laboratory</span><span>Radar</span>
        <span class="u-man-shed--warn">Laser Turret</span>
        <span class="u-man-shed--warn">Missile Launcher</span>
        <span>Security HQ</span><span>Hospital</span><span>Hydroponics</span>
        <span>Morgro Hydroponics</span><span>Moss Converter</span><span>Life Support</span>
      </div>

      <p><b>Your defences are shed tenth and eleventh</b> &mdash; before hospitals, before
      food, before air. A colony that is merely a little short on power will quietly
      switch off its own turrets and launchers while everything else keeps running.
      If enemies are getting through untouched, check power before you check anything else.</p>

      <p>A <b>Flux Pod</b> banks 200 MW as a buffer. Life Support banks up to 800 air per
      building, which is what carries you through an eclipse.</p>

      <h4>Staffing</h4>
      <p>Mines, plants, labs, arms labs, workshops, hospitals and security need
      <b>staff</b> (max 10 each, 30 for a Ship Yard). Output scales directly with the
      number of staffed workers &mdash; a fully built, fully powered, <i>unstaffed</i> mine
      produces nothing at all.</p>

      <p class="u-hint">Food spoils: the pool is capped at twice your monthly production,
      so stockpiling beyond that is wasted.</p>`,
  },
  {
    id: 'weapons',
    title: 'Weapons &amp; defence',
    html: `
      <p>The single most common mistake: <b>not every defence structure fires by itself</b>,
      and one of them is not a weapon at all.</p>

      <table class="u-man-table">
        <thead><tr><th>Structure</th><th>Fires</th><th>Range</th><th>Damage</th></tr></thead>
        <tbody>
          <tr><td>Laser Turret</td><td class="u-man-auto">Automatic</td><td>6</td><td>10 / 2 days</td></tr>
          <tr><td>&nbsp;&nbsp;&mdash; with Plasma Gun</td><td class="u-man-auto">Automatic</td><td>7</td><td>18 / 2 days</td></tr>
          <tr><td>Missile Launcher</td><td class="u-man-man">Manual</td><td>10</td><td>80, single use</td></tr>
          <tr><td>&nbsp;&nbsp;&mdash; with HDX</td><td class="u-man-man">Manual</td><td>16</td><td>140, single use</td></tr>
          <tr><td>Land Mine</td><td class="u-man-auto">Trigger</td><td>adjacent</td><td>120, single use</td></tr>
          <tr><td>Launch Pad</td><td colspan="3" class="u-man-non">Not a weapon &mdash; it holds and refuels one ship</td></tr>
        </tbody>
      </table>

      <h4>Laser Turret</h4>
      <p>Fires on its own, but only when <b>powered</b>, and only when the target is inside
      its <b>30&deg; cone</b>. A turret that is facing the wrong way rotates just 30&deg;
      every 2 days to search &mdash; so a newly built turret (which starts facing 0&deg;) can
      take several days to bring a target to bear.</p>
      <p>At 10 damage every 2 days, one turret needs <b>16 days</b> to kill an 80 HP Alien
      Tank. Turrets are not meant to work alone: overlap three or four fields of fire, and
      research <b>Plasma Gun</b> to nearly double their output.</p>

      <h4>Missile Launcher</h4>
      <p>Does <b>not</b> auto-fire. You aim it yourself:</p>
      <ol>
        <li>Hover the target tile and press a number key <b>1&ndash;8</b> to drop a tactical marker.</li>
        <li>Click the launcher to open it, and find <b>Missile Control</b>.</li>
        <li>Click the matching marker button to launch.</li>
      </ol>
      <p>It is <b>single use</b> &mdash; the launcher is consumed and the tile freed. A basic
      missile only connects if an enemy is within about 1.5 tiles of the marker; <b>HDX</b>
      missiles track the nearest enemy automatically and reach much further.</p>

      <h4>Land Mine</h4>
      <p>Buried and invisible to the enemy. Detonates for 120 damage &mdash; usually a
      one-shot kill &mdash; when an enemy <b>ground</b> unit walks onto it. Flying units pass
      over harmlessly. Requires Tech Level 4.</p>

      <h4>Tanks and ships</h4>
      <p>These engage automatically every day against the nearest enemy in range, with no
      orders needed. A Tank does 10 at range 2; a Warship does 32 at range 4. They will not
      fire while deployed off-map at the alien city.</p>

      <p class="u-hint">Fund the <b>Arms Laboratory</b> &mdash; tanks and ships both cost
      weapons units to build, and nothing else produces them.</p>`,
  },
  {
    id: 'research',
    title: 'Research, trade &amp; spying',
    html: `
      <h4>Research</h4>
      <p>Laboratories staffed with scientists generate research points. Advancing from tech
      level L to L+1 costs <b>400 &times; L</b> points, up to level 10. Full funding is
      200 GR per scientist per month &mdash; underfund them and they work proportionally
      slower.</p>
      <p>Each new level unlocks inventions. Critically, <b>inventions apply to buildings
      constructed afterwards</b>, not retroactively: an existing Missile Launcher does not
      gain HDX, and existing Hydroponics do not become Morgro. Rebuild to upgrade.</p>

      <h4>Trade</h4>
      <p>Needs an active <b>Command Centre</b>. Surplus commodities are sold automatically
      each month above the <b>retain</b> levels you set &mdash; anything held back is kept
      for your own use. You may also trade manually <b>once per calendar month</b>.
      Gems (120 GR) and tech goods (60 GR) are the high-value exports; a Workshop produces
      tech goods purely to sell.</p>
      <p class="u-hint">Flooding the market with one commodity depresses its price.</p>

      <h4>Spying</h4>
      <p>Set an intelligence budget and the level follows the balance you can sustain:</p>
      <ul>
        <li><b>Low Level Surveillance</b> (300 GR/mo) &mdash; a report every 2 months, 1 week of warning.</li>
        <li><b>Normal Intelligence</b> (800 GR/mo) &mdash; monthly reports, 2 weeks of warning.</li>
        <li><b>Special Operatives</b> (2,000 GR/mo) &mdash; twice-monthly reports, <b>4 weeks</b> of warning, plus estimates of the alien city's defences.</li>
      </ul>
      <p>That warning window is the whole point: it is how much time you get to power up
      turrets and reposition before a wave lands.</p>

      <h4>The alien city</h4>
      <p>Winning outright means destroying the enemy city. You must first <b>locate</b> it
      by spying, then send ships (14 days travel) or tanks (28 days). Units resolve the
      assault off-map and cannot defend home while away &mdash; the classic trap is
      committing everything and leaving the colony bare.</p>`,
  },
  {
    id: 'controls',
    title: 'Controls',
    html: `
      <table class="u-man-table u-man-table--keys">
        <tbody>
          <tr><td>Left click</td><td>Select or inspect a tile, building or unit; place buildings in Build mode</td></tr>
          <tr><td>Right click / <b>Esc</b></td><td>Cancel mode, close panel, return to Info</td></tr>
          <tr><td>Middle- or right-drag</td><td>Pan the camera</td></tr>
          <tr><td><b>WASD</b> / arrows</td><td>Pan the camera</td></tr>
          <tr><td>Screen edge</td><td>Edge scroll (the live band sits just inside the status bar and icon rail)</td></tr>
          <tr><td>Mouse wheel</td><td>Zoom toward the cursor</td></tr>
          <tr><td><b>B</b></td><td>Build palette</td></tr>
          <tr><td><b>X</b></td><td>Demolish mode (a second click on wreckage clears it)</td></tr>
          <tr><td><b>M</b></td><td>Colony map screen and overlays</td></tr>
          <tr><td><b>P</b> / <b>Space</b></td><td>Pause / resume</td></tr>
          <tr><td><b>F1</b>&ndash;<b>F6</b></td><td>The six advisers</td></tr>
          <tr><td><b>1</b>&ndash;<b>8</b></td><td>Place or move a tactical marker on the hovered tile</td></tr>
          <tr><td><b>Shift+D</b></td><td>Clear all markers</td></tr>
          <tr><td><b>H</b> / <b>?</b></td><td>This manual</td></tr>
        </tbody>
      </table>

      <p class="u-hint">Markers are not decoration &mdash; they are how you aim missile
      launchers, and how the Tank Teleport picks its destination.</p>

      <h4>Saving</h4>
      <p>Saves are plain JSON files downloaded to your machine; there is no server. Use
      <b>Disk / Options</b> to save or load. An autosave is kept in browser storage and
      offered as <b>Resume</b> on the title screen. The simulation is deterministic, so a
      restored save replays identically.</p>`,
  },
];

let activeId = SECTIONS[0].id;

export function openManual(ctx: UIContext, sectionId?: string): void {
  if (sectionId) activeId = sectionId;
  openPanel(ctx, {
    id: 'manual',
    title: 'Colony Manual',
    size: 'full',
    render(body) {
      const wrap = el('div', 'u-man');
      const nav = el('div', 'u-man-nav');
      const content = el('div', 'u-man-content');

      const paint = (): void => {
        const sec = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0];
        content.replaceChildren(elHtml('div', 'u-man-body', sec.html));
        content.scrollTop = 0;
        for (const b of nav.children) {
          b.classList.toggle('u-man-nav-btn--on', (b as HTMLElement).dataset.id === sec.id);
        }
      };

      for (const s of SECTIONS) {
        const b = button('u-man-nav-btn', '', () => { activeId = s.id; paint(); });
        b.innerHTML = s.title;
        b.dataset.id = s.id;
        nav.appendChild(b);
      }

      wrap.append(nav, content);
      body.appendChild(wrap);
      paint();
    },
  });
}
