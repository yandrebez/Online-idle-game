#!/usr/bin/env node
/* =============================================================================
   Writes ad network IDs into js/ads-config.js and ads.txt.

   Driven by environment variables so the "Configure ads" GitHub Action can
   collect the IDs in a form and nobody has to edit JavaScript by hand:

     MONETAG_ZONE          numeric rewarded-interstitial zone id
     MONETAG_SDK_DOMAIN    domain from the Monetag snippet
     MONETAG_INTERSTITIAL  optional separate interstitial zone id
     ADSTERRA_KEY          banner key (the long hex string)
     ADSENSE_CLIENT        ca-pub-XXXXXXXXXXXXXXXX
     ADSENSE_BANNER        responsive display unit slot id
     ADSENSE_RECTANGLE     300x250 display unit slot id

   An empty or unset variable leaves that setting untouched, so you can run it
   again later to add a network without clearing the ones already configured.
   ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = path.join(ROOT, 'js', 'ads-config.js');
const ADS_TXT = path.join(ROOT, 'ads.txt');

/** key in ads-config.js -> environment variable holding its new value */
const FIELDS = [
  { key: 'rewardedZone',     env: 'MONETAG_ZONE',         label: 'Monetag rewarded zone' },
  { key: 'sdkDomain',        env: 'MONETAG_SDK_DOMAIN',   label: 'Monetag SDK domain' },
  { key: 'interstitialZone', env: 'MONETAG_INTERSTITIAL', label: 'Monetag interstitial zone' },
  { key: 'bannerKey',        env: 'ADSTERRA_KEY',         label: 'Adsterra banner key' },
  { key: 'client',           env: 'ADSENSE_CLIENT',       label: 'AdSense client' },
  { key: 'banner',           env: 'ADSENSE_BANNER',       label: 'AdSense banner slot' },
  { key: 'rectangle',        env: 'ADSENSE_RECTANGLE',    label: 'AdSense rectangle slot' }
];

function clean(v) {
  return (v || '').trim();
}

/** Reject anything that could break out of the string literal it lands in. */
function validate(label, value) {
  if (/['"\\\r\n]/.test(value)) {
    throw new Error(`${label}: quotes, backslashes and newlines are not allowed (got ${JSON.stringify(value)})`);
  }
  if (value.length > 200) {
    throw new Error(`${label}: value is implausibly long (${value.length} chars)`);
  }
}

function setField(source, key, value) {
  // Matches `key: 'old value'` or `key: ""` exactly once, keeping indentation
  // and any trailing comma or comment on the line.
  const re = new RegExp(`(\\b${key}\\s*:\\s*)(['"])([^'"]*)\\2`);
  if (!re.test(source)) {
    throw new Error(`could not find "${key}" in js/ads-config.js`);
  }
  return source.replace(re, (_m, head, quote) => `${head}${quote}${value}${quote}`);
}

function updateAdsTxt(client) {
  // AdSense wants ads.txt to name the publisher id, or it bids the inventory down.
  const pub = client.replace(/^ca-/, '');            // ca-pub-123… -> pub-123…
  const line = `google.com, ${pub}, DIRECT, f08c47fec0942fa0`;

  let text = fs.readFileSync(ADS_TXT, 'utf8');
  if (text.includes(line)) return false;

  // Drop any previous google.com line so re-running never leaves two.
  text = text.split('\n').filter(l => !/^\s*google\.com,/.test(l)).join('\n');
  if (!text.endsWith('\n')) text += '\n';
  fs.writeFileSync(ADS_TXT, text + line + '\n');
  return true;
}

function main() {
  let source = fs.readFileSync(CONFIG, 'utf8');
  const applied = [];

  for (const field of FIELDS) {
    const value = clean(process.env[field.env]);
    if (!value) continue;
    validate(field.label, value);
    source = setField(source, field.key, value);
    applied.push(`${field.label} = ${value}`);
  }

  if (!applied.length) {
    console.log('No ad IDs supplied — nothing to change.');
    return 0;
  }

  fs.writeFileSync(CONFIG, source);

  const client = clean(process.env.ADSENSE_CLIENT);
  if (client && updateAdsTxt(client)) applied.push('ads.txt updated with the AdSense publisher id');

  console.log('Applied:');
  applied.forEach(line => console.log('  - ' + line));
  return 0;
}

try {
  process.exit(main());
} catch (err) {
  console.error('Failed: ' + err.message);
  process.exit(1);
}
