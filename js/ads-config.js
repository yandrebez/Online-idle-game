/* =============================================================================
   NANO FORGE — AD CONFIGURATION
   -----------------------------------------------------------------------------
   This is the ONLY file you need to edit to turn on monetization.
   Paste your IDs below, commit, and ads go live. Leave a value as "" to
   disable that placement (a harmless house placeholder is shown instead).

   See README.md -> "Turning on the money" for step-by-step signup links.
   ========================================================================== */

window.AD_CONFIG = {
  // Master switch. false = no ad network scripts load at all.
  enabled: true,

  // Show an EU/UK/CH consent banner before loading any ad script.
  // Keep this true — it is required for EEA traffic and harmless elsewhere.
  requireConsent: true,

  /* ---------------------------------------------------------------------------
     1. GOOGLE ADSENSE  (best payouts, needs manual approval ~1-14 days)
     Sign up: https://adsense.google.com
     After approval create two "Display" ad units and paste their slot IDs.
  --------------------------------------------------------------------------- */
  adsense: {
    client: '',          // e.g. 'ca-pub-1234567890123456'
    slots: {
      banner: '',        // responsive unit -> sticky footer banner
      rectangle: ''      // 300x250 unit -> desktop side rail
    },
    // Google's own consent tool. If you enable Funding Choices in AdSense,
    // set this true and the built-in banner steps aside for Google's CMP.
    useFundingChoices: false
  },

  /* ---------------------------------------------------------------------------
     2. ADSTERRA  (instant approval, pays on a subdomain, good CPM fallback)
     Sign up: https://adsterra.com  -> Publisher -> Add website -> get keys.
  --------------------------------------------------------------------------- */
  adsterra: {
    bannerKey: '',       // 728x90 or 320x50 "Banner" key (the long hex string)
    bannerWidth: 728,
    bannerHeight: 90,
    nativeContainer: ''  // optional Native Banner container id, e.g. 'container-abc123'
  },

  /* ---------------------------------------------------------------------------
     3. MONETAG  (instant approval — this is what powers REWARDED VIDEO)
     Sign up: https://monetag.com -> Add site -> create a
     "Rewarded Interstitial" zone -> paste the numeric Zone ID.
     Monetag explicitly allows reward-for-view, which AdSense does NOT.
  --------------------------------------------------------------------------- */
  monetag: {
    rewardedZone: '',    // e.g. '8765432'  (numeric zone id)
    sdkDomain: 'vemtoutcheeg.com', // Monetag gives you this in the snippet
    interstitialZone: '' // optional: extra zone shown on prestige
  },

  /* ---------------------------------------------------------------------------
     BEHAVIOUR
  --------------------------------------------------------------------------- */
  behaviour: {
    // If no rewarded network is configured or the network has no ad to show,
    // still give the player the reward. Keeps the game fun before you set up
    // ad accounts, and avoids punishing players on a no-fill.
    grantRewardOnNoFill: true,

    // Minimum seconds between two interstitials. Respect your players.
    interstitialCooldownSec: 180,

    // Show the sticky footer banner at all.
    footerBanner: true,

    // Show the 300x250 side rail on screens wider than 1100px.
    sideRail: true
  }
};
