/**
 * ============================================================================
 * VINTAGE ROYAL TELETYPE ENGINE // MODEL 1954
 * Single-Paper Interactive Teletype Wizard
 * Procedural Web Audio API // Authentic Platen Physics // Mechanical Ratchets
 * ============================================================================
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. PROCEDURAL & PCM MECHANICAL AUDIO ENGINE (CHROME / SAFARI / MOBILE RESILIENT)
  // Dedicated Assets: key003.wav, return005.wav, paper_feed.wav
  // Zero-latency memory Blob pool + Web Audio API buffer playback + Autoplay unlock
  // ==========================================================================
  const AudioEngine = {
    ctx: null,
    masterGain: null,
    soundEnabled: true,
    unlocked: false,
    buffers: {
      key: null,
      return: null,
      paperFeed: null
    },
    blobUrls: {
      key: null,
      return: null,
      paperFeed: null
    },
    audioPools: {
      key: [],
      return: [],
      paperFeed: []
    },
    poolIndices: {
      key: 0,
      return: 0,
      paperFeed: 0
    },
    loadingStarted: false,

    init() {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          try {
            this.ctx = new AudioContextClass();
            // Direct master gain without ducking compressor for loud, authentic mechanical clacks
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(1.8, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);
          } catch (_) {}
        }
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      if (!this.loadingStarted) {
        this.loadAudioAssets();
      }
    },

    unlock() {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.ctx && !this.unlocked) {
        try {
          // Play a 1-sample silent buffer to unlock the audio hardware clock immediately
          const silentBuf = this.ctx.createBuffer(1, 1, 22050);
          const silentSrc = this.ctx.createBufferSource();
          silentSrc.buffer = silentBuf;
          silentSrc.connect(this.ctx.destination);
          silentSrc.start(0);
          this.unlocked = true;
        } catch (_) {}
      }
    },

    loadAudioAssets() {
      if (this.loadingStarted) return;
      this.loadingStarted = true;

      const base64ToArrayBuffer = (b64) => {
        try {
          const bin = window.atob(b64);
          const len = bin.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
          return bytes.buffer;
        } catch (_) {
          return null;
        }
      };

      const base64ToBlobUrl = (b64) => {
        try {
          const bin = window.atob(b64);
          const len = bin.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'audio/wav' });
          return URL.createObjectURL(blob);
        } catch (_) {
          return null;
        }
      };

      // 1. FAST PATH: Synchronous Blob URL + Audio Pool creation from embedded base64 data
      if (window.TYPEWRITER_AUDIO_DATA) {
        const d = window.TYPEWRITER_AUDIO_DATA;
        ['key', 'return', 'paperFeed'].forEach((type) => {
          const b64 = d[type];
          if (!b64) return;

          // Create memory Blob URL (Zero-latency instant playback)
          const blobUrl = base64ToBlobUrl(b64);
          if (blobUrl) {
            this.blobUrls[type] = blobUrl;
            const poolSize = (type === 'key') ? 12 : 4;
            const pool = [];
            for (let i = 0; i < poolSize; i++) {
              const a = new Audio(blobUrl);
              a.preload = 'auto';
              pool.push(a);
            }
            this.audioPools[type] = pool;
          }

          // Asynchronously decode into Web Audio Buffer for microsecond precision & pitch randomization
          const ab = base64ToArrayBuffer(b64);
          if (ab) {
            this.decodeBuffer(ab, (buf) => {
              if (buf) this.buffers[type] = buf;
            });
          }
        });
      }

      // 2. NETWORK / LOCAL FILE PATHS BACKUP FETCH
      const soundFiles = {
        key: ['assets/sounds/key003.wav', 'public/assets/sounds/key003.wav'],
        return: ['assets/sounds/return005.wav', 'public/assets/sounds/return005.wav'],
        paperFeed: ['assets/sounds/paper_feed.wav', 'public/assets/sounds/paper_feed.wav']
      };

      Object.keys(soundFiles).forEach((type) => {
        if (!this.buffers[type]) {
          const tryFetch = (urls) => {
            if (!urls || !urls.length) return;
            const url = urls[0];
            fetch(url)
              .then(res => res.ok ? res.arrayBuffer() : null)
              .then(ab => {
                if (ab) {
                  this.decodeBuffer(ab, (buf) => {
                    if (buf && !this.buffers[type]) this.buffers[type] = buf;
                  });
                } else {
                  tryFetch(urls.slice(1));
                }
              })
              .catch(() => tryFetch(urls.slice(1)));
          };
          tryFetch(soundFiles[type]);
        }
      });
    },

    decodeBuffer(ab, onSuccess) {
      if (!this.ctx || !ab) return;
      try {
        const copy = ab.slice(0); // slice(0) avoids detached ArrayBuffer issues
        let completed = false;
        const cb = (buf) => {
          if (!completed && buf) {
            completed = true;
            onSuccess(buf);
          }
        };
        const p = this.ctx.decodeAudioData(copy, cb, () => {});
        if (p && typeof p.then === 'function') {
          p.then(cb).catch(() => {});
        }
      } catch (_) {}
    },

    toggleSound() {
      this.soundEnabled = !this.soundEnabled;
      return this.soundEnabled;
    },

    playAudio(type, { pitch = 1.0, volume = 1.0 } = {}) {
      if (!this.soundEnabled) return false;
      this.unlock();

      // Tier 1: Web Audio Buffer (Zero latency, full dynamic headroom, pitch variation)
      const buffer = this.buffers[type];
      if (buffer && this.ctx && this.ctx.state === 'running') {
        try {
          const src = this.ctx.createBufferSource();
          src.buffer = buffer;
          src.playbackRate.setValueAtTime(pitch, this.ctx.currentTime);

          const gainNode = this.ctx.createGain();
          gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);

          src.connect(gainNode);
          gainNode.connect(this.masterGain || this.ctx.destination);
          src.start(0);
          return true;
        } catch (_) {}
      }

      // Tier 2: Instant Preloaded HTML5 Audio Pool (Fast Blob URL fallback)
      const pool = this.audioPools[type];
      if (pool && pool.length) {
        try {
          const idx = this.poolIndices[type] % pool.length;
          this.poolIndices[type]++;
          const audio = pool[idx];
          audio.volume = Math.max(0, Math.min(1.0, volume));
          audio.currentTime = 0;
          const p = audio.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {});
          }
          return true;
        } catch (_) {}
      }

      // Tier 3: Standalone Audio Element with local sound file path or Blob URL
      const path = (window.TYPEWRITER_AUDIO_PATHS && window.TYPEWRITER_AUDIO_PATHS[type]) || ('assets/sounds/' + (type === 'key' ? 'key003.wav' : type === 'return' ? 'return005.wav' : 'paper_feed.wav'));
      const srcUrl = this.blobUrls[type] || path;
      if (srcUrl) {
        try {
          const audio = new Audio(srcUrl);
          audio.volume = Math.max(0, Math.min(1.0, volume));
          const p = audio.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {});
          }
          return true;
        } catch (_) {}
      }

      return false;
    },

    // 1. KEY003.WAV: Used for alphabet keys, numbers, space, backspace, and arrow navigation
    playKeySound() {
      if (!this.soundEnabled) return;
      this.unlock();
      const pitch = 0.98 + (Math.random() * 0.04);
      const played = this.playAudio('key', { pitch, volume: 1.0 });
      if (!played) {
        this.synthKeyClack(950);
      }
    },

    // 2. RETURN005.WAV: Used for enter button when confirming choices / turning page
    playReturnSound() {
      if (!this.soundEnabled) return;
      this.unlock();
      const played = this.playAudio('return', { pitch: 1.0, volume: 1.0 });
      if (!played) {
        this.synthReturnLever();
      }
    },

    // 3. PAPER_FEED.WAV: Used for the page turning sound
    playPaperRollSound() {
      if (!this.soundEnabled) return;
      this.unlock();
      const played = this.playAudio('paperFeed', { pitch: 1.0, volume: 1.0 });
      if (!played) {
        this.synthPaperRoll();
      }
    },

    playPaperSlideSound() {
      this.playPaperRollSound();
    },

    playLampSwitchSound() {
      this.init();
      if (!this.soundEnabled) return;
      if (!this.ctx) return;
      try {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        const now = Math.max(this.ctx.currentTime, 0.01) + 0.002;

        // 1. Initial chain links rustle (metallic beaded chain sliding through socket eyelet)
        const rattleDur = 0.06;
        const rattleBuf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * rattleDur), this.ctx.sampleRate);
        const rData = rattleBuf.getChannelData(0);
        for (let i = 0; i < rData.length; i++) rData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (rData.length * 0.4));
        const rattleSrc = this.ctx.createBufferSource();
        rattleSrc.buffer = rattleBuf;
        const rFilter = this.ctx.createBiquadFilter();
        rFilter.type = 'bandpass';
        rFilter.frequency.setValueAtTime(3200, now);
        rFilter.Q.setValueAtTime(4.0, now);
        const rGain = this.ctx.createGain();
        rGain.gain.setValueAtTime(0.22, now);
        rGain.gain.exponentialRampToValueAtTime(0.001, now + rattleDur);
        rattleSrc.connect(rFilter);
        rFilter.connect(rGain);
        rGain.connect(this.masterGain || this.ctx.destination);
        rattleSrc.start(now);

        // 2. Dual-action mechanical switch snap ("click-snick")
        const clickTimes = [now + 0.045, now + 0.075];
        clickTimes.forEach((t, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = idx === 0 ? 'triangle' : 'square';
          osc.frequency.setValueAtTime(idx === 0 ? 1450 : 880, t);
          osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 280 : 180, t + 0.035);
          gain.gain.setValueAtTime(idx === 0 ? 0.45 : 0.65, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
          osc.connect(gain);
          gain.connect(this.masterGain || this.ctx.destination);
          osc.start(t);
          osc.stop(t + 0.04);
        });

        // 3. Resonant brass bell/lamp housing acoustic body ping
        const ringOsc = this.ctx.createOscillator();
        const ringGain = this.ctx.createGain();
        ringOsc.type = 'sine';
        ringOsc.frequency.setValueAtTime(1150, now + 0.075);
        ringOsc.frequency.exponentialRampToValueAtTime(1120, now + 0.22);
        ringGain.gain.setValueAtTime(0.18, now + 0.075);
        ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
        ringOsc.connect(ringGain);
        ringGain.connect(this.masterGain || this.ctx.destination);
        ringOsc.start(now + 0.075);
        ringOsc.stop(now + 0.25);
      } catch (_) {}
    },

    playRatchetClick() {},
    playBell() {},
    playJam() {
      this.playKeySound();
    },

    // PROCEDURAL SYNTHESIZER FALLBACKS
    synthKeyClack(baseFreq = 950) {
      if (!this.ctx) return;
      try {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        const now = Math.max(this.ctx.currentTime, 0.01) + 0.005;
        const dur = 0.04;
        const bufSize = Math.floor(this.ctx.sampleRate * dur);
        const noiseBuf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const out = noiseBuf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) out[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuf;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(baseFreq, now);
        filter.Q.setValueAtTime(3.5, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.65, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        noise.start(now);
      } catch (_) {}
    },

    synthReturnLever() {
      if (!this.ctx) return;
      try {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        const now = Math.max(this.ctx.currentTime, 0.01) + 0.005;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      } catch (_) {}
    },

    synthPaperRoll() {
      if (!this.ctx) return;
      try {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        const now = Math.max(this.ctx.currentTime, 0.01) + 0.005;
        const dur = 0.25;
        const bufSize = Math.floor(this.ctx.sampleRate * dur);
        const noiseBuf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const out = noiseBuf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) out[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuf;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        noise.start(now);
      } catch (_) {}
    }
  };

  // Global user gesture unlock for modern browsers (captures user interaction immediately)
  const unlockEvents = ['pointerdown', 'mousedown', 'keydown', 'touchstart', 'click'];
  const globalUnlock = () => {
    AudioEngine.unlock();
  };
  unlockEvents.forEach((evt) => {
    window.addEventListener(evt, globalUnlock, { capture: true, passive: true });
    document.addEventListener(evt, globalUnlock, { capture: true, passive: true });
  });

  window.AudioEngine = AudioEngine;
  const MechAudio = AudioEngine;

  // ==========================================================================
  // 2. MASTER STATE & WIZARD COPY SCHEMA (REFRESHED TELETYPE)
  // ==========================================================================
  const WIZARD_SCHEMA = {
    1: {
      tag: '01 // SYSTEM & WORKFLOW SCOPE',
      title: 'System & Workflow Scope',
      ref: 'SYS-01 // SCOPE',
      stepLabel: '[ 01 / 04 ]',
      directive: 'Define the systems and repetitive processes you need connected.',
      fieldLabel: 'PRIMARY OBJECTIVE',
      footerStamp: 'PRESS [1-4] OR CLICK // ENTER ↵ TO CONFIRM',
      options: [
        {
          num: 1,
          id: 'crm_pipeline',
          label: 'CRM & Pipeline Automation',
          tag: 'CRM/PIPELINE',
          brief: 'Connect your CRM, lead capture pipeline, and qualification stages automatically.'
        },
        {
          num: 2,
          id: 'ops_doc_proc',
          label: 'Internal Ops & Document Processing',
          tag: 'INTERNAL/OPS',
          brief: 'Automate invoice routing, document parsing, approvals, and internal team tasks.'
        },
        {
          num: 3,
          id: 'client_onboarding',
          label: 'Client Onboarding Workflows',
          tag: 'ONBOARDING',
          brief: 'Streamline contract execution, client portal setups, provisioning, and handoffs.'
        },
        {
          num: 4,
          id: 'custom_api_sync',
          label: 'Custom API Integration & Data Sync',
          tag: 'CUSTOM/API',
          brief: 'Bi-directional real-time data sync across databases, legacy tools, and third-party APIs.'
        }
      ]
    },
    2: {
      tag: '02 // TIMELINE & TARGET DEPLOYMENT',
      title: 'Timeline & Target Deployment',
      ref: 'CAD-02 // VELOCITY',
      stepLabel: '[ 02 / 04 ]',
      directive: 'When does this system need to be live in production?',
      fieldLabel: 'DEPLOYMENT TIMELINE',
      footerStamp: 'SELECTION SAVED // PRESS ENTER ↵ TO ROLL',
      options: [
        {
          num: 1,
          id: 'immediate',
          label: 'Immediate (Within 2 weeks) — Production blocker',
          tag: '< 2 WEEKS',
          brief: 'Emergency rapid sprint to eliminate critical manual bottlenecks or unblock revenue.'
        },
        {
          num: 2,
          id: 'targeted',
          label: 'Targeted (3–6 weeks) — Planned initiative',
          tag: '3-6 WEEKS',
          brief: 'Structured deployment sprint with technical reviews, staging iterations, and user testing.'
        },
        {
          num: 3,
          id: 'flexible',
          label: 'Flexible (Q1/Q2 roadmap) — Evaluating feasibility',
          tag: 'ROADMAP',
          brief: 'Architecture planning, technical feasibility study, or staged milestones over coming quarters.'
        }
      ]
    },
    3: {
      tag: '03 // SCOPE & BUDGET ALLOCATION',
      title: 'Scope & Budget Allocation',
      ref: 'CAP-03 // ALLOCATION',
      stepLabel: '[ 03 / 04 ]',
      directive: 'Help us match the architecture complexity to your investment tier.',
      fieldLabel: 'INVESTMENT TIER',
      footerStamp: 'SELECTION SAVED // PRESS ENTER ↵ TO ROLL',
      options: [
        {
          num: 1,
          id: 'sprint_pilot',
          label: 'Sprint Pilot ($2k – $5k) — Single workflow or MVP integration',
          tag: '$2K-$5K',
          brief: 'Targeted single workflow automation or proof-of-concept pipeline (< 1,000 tasks/mo).'
        },
        {
          num: 2,
          id: 'standard_prod',
          label: 'Standard Production ($5k – $15k) — End-to-end department automation',
          tag: '$5K-$15K',
          brief: 'Multi-step departmental workflows, webhook routing, error resilience (1,000 – 25,000 tasks/mo).'
        },
        {
          num: 3,
          id: 'enterprise_sys',
          label: 'Enterprise System ($15k+) — Multi-platform architecture & custom APIs',
          tag: '$15K+',
          brief: 'High-availability multi-cloud architecture, custom microservices, SLA monitoring (25,000+ tasks/mo).'
        }
      ]
    },
    4: {
      tag: '04 // DISPATCH & DELIVERY DETAILS',
      title: 'Dispatch & Delivery Details',
      ref: 'LEDGER-04 // CONTACT',
      stepLabel: '[ 04 / 04 ]',
      directive: 'Where should our technical lead send the architecture audit and feasibility report?',
      footerStamp: 'REVIEW SUMMARY BEFORE SENDING ↵'
    }
  };

  const WIZARD_STATE = {
    step: 1,
    capability: null,
    capabilityBrief: null,
    velocity: null,
    velocityBrief: null,
    capital: null,
    capitalBrief: null,
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientNotes: '',
    teamMessage: ''
  };

  window.WIZARD_SCHEMA = WIZARD_SCHEMA;
  window.WIZARD_STATE = WIZARD_STATE;

  // ==========================================================================
  // 3. KEYBOARD WELL & 3D MECHANICAL KEYBED LAYOUT
  // ==========================================================================
  const KEYBOARD_ROWS = [
    [
      { label: '1', code: 'Digit1', sub: '!' },
      { label: '2', code: 'Digit2', sub: '"' },
      { label: '3', code: 'Digit3', sub: '#' },
      { label: '4', code: 'Digit4', sub: '$' },
      { label: '5', code: 'Digit5', sub: '%' },
      { label: '6', code: 'Digit6', sub: '_' },
      { label: '7', code: 'Digit7', sub: '&' },
      { label: '8', code: 'Digit8', sub: "'" },
      { label: '9', code: 'Digit9', sub: '(' },
      { label: '0', code: 'Digit0', sub: ')' },
      { label: '-', code: 'Minus', sub: '*' },
      { label: 'BKSP', code: 'Backspace', width: 'wide-backspace', action: 'backspace' }
    ],
    [
      { label: 'Q', code: 'KeyQ' },
      { label: 'W', code: 'KeyW' },
      { label: 'E', code: 'KeyE' },
      { label: 'R', code: 'KeyR' },
      { label: 'T', code: 'KeyT' },
      { label: 'Y', code: 'KeyY' },
      { label: 'U', code: 'KeyU' },
      { label: 'I', code: 'KeyI' },
      { label: 'O', code: 'KeyO' },
      { label: 'P', code: 'KeyP' }
    ],
    [
      { label: 'A', code: 'KeyA' },
      { label: 'S', code: 'KeyS' },
      { label: 'D', code: 'KeyD' },
      { label: 'F', code: 'KeyF' },
      { label: 'G', code: 'KeyG' },
      { label: 'H', code: 'KeyH' },
      { label: 'J', code: 'KeyJ' },
      { label: 'K', code: 'KeyK' },
      { label: 'L', code: 'KeyL' },
      { label: ';', code: 'Semicolon', sub: ':' },
      { label: 'RET', code: 'Enter', width: 'wide-return', action: 'enter' }
    ],
    [
      { label: 'Z', code: 'KeyZ' },
      { label: 'X', code: 'KeyX' },
      { label: 'C', code: 'KeyC' },
      { label: 'V', code: 'KeyV' },
      { label: 'B', code: 'KeyB' },
      { label: 'N', code: 'KeyN' },
      { label: 'M', code: 'KeyM' },
      { label: ',', code: 'Comma' },
      { label: '.', code: 'Period' },
      { label: '/', code: 'Slash', sub: '?' }
    ]
  ];

  // ==========================================================================
  // 4. MAIN TELETYPE ENGINE CLASS
  // ==========================================================================
  class TypewriterEngine {
    constructor() {
      this.sound = AudioEngine;
      this.keyboardDeck = document.getElementById('keyboard-deck');
      this.typewriterPaper = document.getElementById('typewriterPaper');
      this.paperContent = document.getElementById('paperContent');
      this.carriageLever = document.getElementById('carriage-lever');
      this.hiddenInput = document.getElementById('hidden-input');
      this.lightToggleBtn = document.getElementById('glassLightToggle');
      this.lampLit = true;
      this.summaryModal = document.getElementById('summary-modal');
      this.fullFrameReview = document.getElementById('full-frame-review');
      this.reviewConfirmBtn = document.getElementById('review-confirm-btn');
      this.reviewBackBtn = document.getElementById('review-back-btn');
      this.transmittedStamp = document.getElementById('transmitted-stamp');

      this.activeHeldKeys = new Set();
      this.pressedKeyCaps = new Set();
      this.isRolling = false;
      this.focusedIndex = 0;
      this.selectedOption = null;

      // Wheel & Mechanical Platen Physics
      this.paperScrollY = 0;
      this.MIN_SCROLL = -140;
      this.MAX_SCROLL = 40;
      this.lastRatchetTime = 0;
    }

    init() {
      this.build3DKeyboard();
      this.bindEvents();
      this.bindPlatenScroll();
      this.renderPaperStep(WIZARD_STATE.step);
    }

    engageMechanicalTerminal() {
      this.sound.init();
    }

    build3DKeyboard() {
      if (!this.keyboardDeck) return;
      this.keyboardDeck.innerHTML = '';

      KEYBOARD_ROWS.forEach((rowDef, rowIdx) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'key-row row-' + rowIdx;

        rowDef.forEach((k) => {
          const cap = document.createElement('div');
          let classNames = 'keycap';
          if (k.width) classNames += ' ' + k.width;
          if (k.action) classNames += ' action-key';
          cap.className = classNames;
          cap.dataset.key = k.label;
          cap.dataset.code = k.code;
          if (k.action) cap.dataset.action = k.action;

          let innerHtml = '<span class="key-label">' + k.label + '</span>';
          if (k.sub) innerHtml += '<span class="key-sub">' + k.sub + '</span>';
          cap.innerHTML = innerHtml;

          cap.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.engageMechanicalTerminal();
            this.triggerKeyAction(k.label, k.code, cap);
          });

          rowEl.appendChild(cap);
        });

        this.keyboardDeck.appendChild(rowEl);
      });

      // Elongated horizontal mechanical spacebar
      const spaceRow = document.createElement('div');
      spaceRow.className = 'spacebar-row flex justify-center items-center mt-2';

      const spaceBtn = document.createElement('button');
      spaceBtn.id = 'key-space';
      spaceBtn.className = 'typewriter-spacebar';
      spaceBtn.dataset.key = ' ';
      spaceBtn.dataset.code = 'Space';
      spaceBtn.dataset.action = 'space';
      spaceBtn.type = 'button';
      spaceBtn.innerHTML = '<span class="spacebar-label">SPACE</span>';

      spaceBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.engageMechanicalTerminal();
        this.triggerKeyAction(' ', 'Space', spaceBtn);
      });

      spaceRow.appendChild(spaceBtn);
      this.keyboardDeck.appendChild(spaceRow);
    }

    bindPlatenScroll() {
      if (!this.typewriterPaper) return;

      this.typewriterPaper.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (this.isRolling) return;

        this.paperScrollY -= e.deltaY * 0.4;
        this.paperScrollY = Math.max(this.MIN_SCROLL, Math.min(this.MAX_SCROLL, this.paperScrollY));

        const now = performance.now();
        if (Math.abs(e.deltaY) > 6 && now - this.lastRatchetTime > 40) {
          this.sound.playRatchetClick();
          this.lastRatchetTime = now;
        }

        this.typewriterPaper.style.transform = 'translateY(' + this.paperScrollY + 'px)';
      }, { passive: false });
    }

    bindEvents() {
      window.addEventListener('keydown', (e) => this.handleKeyDown(e), { passive: false });
      window.addEventListener('keyup', (e) => this.handleKeyUp(e), { passive: true });

      if (this.carriageLever) {
        this.carriageLever.addEventListener('click', () => {
          this.engageMechanicalTerminal();
          if (this.fullFrameReview && this.fullFrameReview.classList.contains('active')) {
            this.finalizeMatrixDispatch();
          } else if (WIZARD_STATE.step === 4) {
            this.openFullFrameReview();
          } else {
            if (this.selectedOption === null) {
              this.selectCurrentOption();
            } else {
              this.executePaperAdvance();
            }
          }
        });
      }

      if (this.reviewBackBtn) {
        this.reviewBackBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeFullFrameReview();
        });
      }

      if (this.reviewConfirmBtn) {
        this.reviewConfirmBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.finalizeMatrixDispatch();
        });
      }

      if (this.lightToggleBtn) {
        const toggleLight = () => {
          this.lampLit = !this.lampLit;
          document.body.classList.toggle('lamp-off', !this.lampLit);
          this.lightToggleBtn.classList.toggle('is-on', this.lampLit);
          this.lightToggleBtn.classList.toggle('is-off', !this.lampLit);
          this.lightToggleBtn.setAttribute('aria-checked', this.lampLit.toString());
          if (this.sound && this.sound.playLampSwitchSound) {
            this.sound.playLampSwitchSound();
          }
          if (typeof navigator.vibrate === 'function') {
            try { navigator.vibrate(18); } catch (_) {}
          }
        };

        this.lightToggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleLight();
        });

        this.lightToggleBtn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleLight();
          }
        });
      }

      document.addEventListener('pointerdown', (e) => {
        if (!e.target.closest('#summary-modal') && !e.target.closest('.option-row') && !e.target.closest('input') && !e.target.closest('textarea')) {
          this.engageMechanicalTerminal();
        }
      });
    }

    handleKeyDown(e) {
      const keyVal = e.key;
      const codeVal = e.code;

      // 1. Space key handling
      if (keyVal === ' ' || codeVal === 'Space') {
        const tag = document.activeElement ? document.activeElement.tagName : '';
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
        }
        this.sound.playKeySound();
      }

      // Check held keys to avoid stutter
      if (this.activeHeldKeys.has(keyVal) || (codeVal && this.activeHeldKeys.has(codeVal))) {
        return;
      }
      this.activeHeldKeys.add(keyVal);
      if (codeVal) this.activeHeldKeys.add(codeVal);

      if (this.summaryModal && this.summaryModal.classList.contains('active')) return;

      if (this.fullFrameReview && this.fullFrameReview.classList.contains('active')) {
        if (keyVal === 'Enter') {
          e.preventDefault();
          this.finalizeMatrixDispatch();
          return;
        }
        if (keyVal === 'Escape' || keyVal === 'Backspace') {
          e.preventDefault();
          this.closeFullFrameReview();
          return;
        }
        return;
      }

      this.engageMechanicalTerminal();

      // Play key003 clack for normal keys, NOT space (played above) and NOT enter (handled contextually)
      if (keyVal !== ' ' && codeVal !== 'Space' && keyVal !== 'Enter') {
        this.sound.playKeySound();
      }

      const keyCap = this.findKeyCap(keyVal, codeVal);
      if (keyCap) {
        keyCap.classList.add('is-pressed', 'plunged');
        this.pressedKeyCaps.add(keyCap);
      }

      if (this.isRolling) return;

      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl.id !== 'hidden-input';

      if (isInputFocused) {
        if (e.key === 'Enter') {
          if (activeEl.tagName === 'TEXTAREA') {
            return;
          }
          // Enter navigates through single-line inputs -> use key003.wav
          e.preventDefault();
          this.sound.playKeySound();
          if (activeEl.id === 'leadName') {
            const next = document.getElementById('leadEmail');
            if (next) next.focus();
          } else if (activeEl.id === 'leadEmail') {
            const next = document.getElementById('leadPhone');
            if (next) next.focus();
          } else if (activeEl.id === 'leadPhone') {
            const next = document.getElementById('teamMessage');
            if (next) next.focus();
          }
        }
        return;
      }

      // Steps 1 to 3
      if (WIZARD_STATE.step < 4) {
        if (keyVal === 'ArrowDown' || keyVal === 'ArrowUp' || keyVal === 'Enter' || keyVal === ' ' || (keyVal >= '1' && keyVal <= '4')) {
          e.preventDefault();
          this.handleKeyNavigation(keyVal);
          return;
        }

        if (keyVal === 'Backspace' && WIZARD_STATE.step > 1) {
          e.preventDefault();
          this.goToPrevStep();
          return;
        }
      } else {
        // Step 4 (when no input is focused) - Enter opens the full-frame review spread
        if (keyVal === 'Enter') {
          e.preventDefault();
          this.openFullFrameReview();
          return;
        }
        if (keyVal === 'Backspace') {
          e.preventDefault();
          this.goToPrevStep();
          return;
        }
      }
    }

    handleKeyUp(e) {
      this.activeHeldKeys.delete(e.key);
      if (e.code) this.activeHeldKeys.delete(e.code);

      const keyCap = this.findKeyCap(e.key, e.code);
      if (keyCap) {
        keyCap.classList.remove('is-pressed', 'plunged');
        this.pressedKeyCaps.delete(keyCap);
      }
    }

    triggerKeyAction(key, code, keyEl) {
      if (keyEl) {
        keyEl.classList.add('is-pressed', 'plunged');
        setTimeout(() => keyEl.classList.remove('is-pressed', 'plunged'), 120);
      }

      if (this.summaryModal && this.summaryModal.classList.contains('active')) return;
      if (this.isRolling) return;

      if (this.fullFrameReview && this.fullFrameReview.classList.contains('active')) {
        if (code === 'Enter' || key === 'RET' || key === 'Enter') {
          this.finalizeMatrixDispatch();
        }
        return;
      }

      // Handle Enter / RET specifically
      if (code === 'Enter' || key === 'RET' || key === 'Enter') {
        if (WIZARD_STATE.step < 4) {
          this.handleKeyNavigation('Enter');
        } else {
          this.openFullFrameReview();
        }
        return;
      }

      // For all alphabet, numbers, backspace, space: play key003.wav
      this.sound.playKeySound();

      if (WIZARD_STATE.step < 4) {
        if (code === 'Backspace' || key === 'BKSP') {
          if (WIZARD_STATE.step > 1) this.goToPrevStep();
          return;
        }
        if (code === 'Space' || key === ' ') {
          this.handleKeyNavigation(' ');
          return;
        }
        if (key >= '1' && key <= '4') {
          this.handleKeyNavigation(key);
          return;
        }
      } else {
        if (code === 'Backspace' || key === 'BKSP') {
          this.goToPrevStep();
          return;
        }
      }
    }

    findKeyCap(key, code) {
      if (code === 'Space' || key === ' ' || key === 'SPACE') {
        return document.getElementById('key-space') || (this.keyboardDeck ? this.keyboardDeck.querySelector('.typewriter-spacebar') : null);
      }
      if (!this.keyboardDeck) return null;
      let target = null;
      if (code) {
        target = this.keyboardDeck.querySelector('[data-code="' + code + '"]');
      }
      if (!target && key) {
        const up = key.toUpperCase();
        target = this.keyboardDeck.querySelector('[data-key="' + up + '"]');
      }
      return target;
    }

    // ========================================================================
    // 5. KEYBOARD SELECTION & ENTER DOUBLE-TAP ADVANCE
    // ========================================================================
    handleKeyNavigation(key) {
      const options = this.paperContent.querySelectorAll('.option-row');
      if (!options.length) return;

      if (key === 'ArrowDown') {
        this.focusedIndex = (this.focusedIndex + 1) % options.length;
        this.updateOptionVisuals();
        this.sound.playKeySound('char');
      } else if (key === 'ArrowUp') {
        this.focusedIndex = (this.focusedIndex - 1 + options.length) % options.length;
        this.updateOptionVisuals();
        this.sound.playKeySound('char');
      } else if (key >= '1' && key <= String(options.length)) {
        this.focusedIndex = parseInt(key, 10) - 1;
        this.selectCurrentOption();
      } else if (key === ' ' || key === 'Space') {
        this.selectCurrentOption();
      } else if (key === 'Enter') {
        if (this.selectedOption === null) {
          // First Enter: Lock selection
          this.selectCurrentOption();
        } else {
          // Second Enter: Confirm and advance paper
          this.executePaperAdvance();
        }
      }
    }

    selectCurrentOption() {
      const options = this.paperContent.querySelectorAll('.option-row');
      if (!options.length || this.focusedIndex < 0 || this.focusedIndex >= options.length) return;

      const currentRow = options[this.focusedIndex];
      this.selectedOption = currentRow.dataset.val;

      this.updateOptionVisuals();
      this.sound.playKeySound('char');
    }

    updateOptionVisuals() {
      const options = this.paperContent.querySelectorAll('.option-row');
      if (!options.length) return;

      options.forEach((row, idx) => {
        const boxEl = row.querySelector('.option-box');

        if (idx === this.focusedIndex) {
          row.classList.add('focused');
        } else {
          row.classList.remove('focused');
        }

        if (this.selectedOption && row.dataset.val === this.selectedOption) {
          row.classList.add('selected');
          if (boxEl) boxEl.textContent = '[ ✓ ]';
        } else {
          row.classList.remove('selected');
          if (boxEl) boxEl.textContent = '[   ]';
        }
      });
    }

    executePaperAdvance() {
      if (this.isRolling) return;
      if (this.selectedOption === null) return;

      if (WIZARD_STATE.step < 4) {
        const schema = WIZARD_SCHEMA[WIZARD_STATE.step];
        const chosen = schema && schema.options ? schema.options.find(o => o.label === this.selectedOption) : null;
        const brief = chosen ? chosen.brief : '';

        if (WIZARD_STATE.step === 1) {
          WIZARD_STATE.capability = this.selectedOption;
          WIZARD_STATE.capabilityBrief = brief;
        }
        if (WIZARD_STATE.step === 2) {
          WIZARD_STATE.velocity = this.selectedOption;
          WIZARD_STATE.velocityBrief = brief;
        }
        if (WIZARD_STATE.step === 3) {
          WIZARD_STATE.capital = this.selectedOption;
          WIZARD_STATE.capitalBrief = brief;
        }

        this.sound.playReturnSound();
        this.transitionToNextPaper(WIZARD_STATE.step + 1);
      }
    }

    transitionToNextPaper(nextStep) {
      if (this.isRolling) return;
      this.isRolling = true;

      // Mechanical Platen Carriage Recoil
      const stageViewport = document.querySelector('.stage-viewport');
      if (stageViewport) {
        stageViewport.classList.remove('carriage-recoil');
        void stageViewport.offsetWidth;
        stageViewport.classList.add('carriage-recoil');
        setTimeout(() => stageViewport.classList.remove('carriage-recoil'), 460);
      }

      this.sound.playPaperRollSound();

      this.paperScrollY = 0;
      if (this.typewriterPaper) {
        this.typewriterPaper.style.transform = '';
        this.typewriterPaper.classList.remove('paper-resting', 'paper-loading-in', 'paper-feed-shudder');
        this.typewriterPaper.classList.add('paper-ejecting');
      }

      setTimeout(() => {
        WIZARD_STATE.step = nextStep;
        this.selectedOption = null;
        this.focusedIndex = 0;
        this.renderPaperStep(WIZARD_STATE.step);

        if (this.typewriterPaper) {
          this.typewriterPaper.classList.remove('paper-ejecting');
          this.typewriterPaper.classList.add('paper-loading-in');
          void this.typewriterPaper.offsetWidth;
          this.typewriterPaper.classList.remove('paper-loading-in');
          this.typewriterPaper.classList.add('paper-resting', 'paper-feed-shudder');
          setTimeout(() => {
            if (this.typewriterPaper) this.typewriterPaper.classList.remove('paper-feed-shudder');
          }, 460);
        }

        this.isRolling = false;
      }, 440);
    }

    goToPrevStep() {
      if (this.isRolling || WIZARD_STATE.step <= 1) return;

      this.isRolling = true;

      // Mechanical Platen Carriage Recoil
      const stageViewport = document.querySelector('.stage-viewport');
      if (stageViewport) {
        stageViewport.classList.remove('carriage-recoil');
        void stageViewport.offsetWidth;
        stageViewport.classList.add('carriage-recoil');
        setTimeout(() => stageViewport.classList.remove('carriage-recoil'), 460);
      }

      this.sound.playPaperRollSound();

      this.paperScrollY = 0;
      if (this.typewriterPaper) {
        this.typewriterPaper.style.transform = '';
        this.typewriterPaper.classList.remove('paper-resting', 'paper-loading-in', 'paper-feed-shudder');
        this.typewriterPaper.classList.add('paper-ejecting');
      }

      setTimeout(() => {
        WIZARD_STATE.step -= 1;
        this.selectedOption = null;
        this.focusedIndex = 0;
        this.renderPaperStep(WIZARD_STATE.step);

        if (this.typewriterPaper) {
          this.typewriterPaper.classList.remove('paper-ejecting');
          this.typewriterPaper.classList.add('paper-loading-in');
          void this.typewriterPaper.offsetWidth;
          this.typewriterPaper.classList.remove('paper-loading-in');
          this.typewriterPaper.classList.add('paper-resting', 'paper-feed-shudder');
          setTimeout(() => {
            if (this.typewriterPaper) this.typewriterPaper.classList.remove('paper-feed-shudder');
          }, 460);
        }

        this.isRolling = false;
      }, 440);
    }

    // ========================================================================
    // 6. DYNAMIC SHEET RENDERER (REFRESHED TELETYPE SCHEMA)
    // ========================================================================
    renderPaperStep(step) {
      if (step < 1) step = 1;
      if (step > 4) step = 4;
      WIZARD_STATE.step = step;

      let html = '';

      if (step >= 1 && step <= 3) {
        const schema = WIZARD_SCHEMA[step];

        html += '<div class="sheet-meta-bar typewriter-ink">';
        html += '  <span>' + schema.tag + ' // ' + schema.ref + '</span>';
        html += '  <span>' + schema.stepLabel + '</span>';
        html += '</div>';

        html += '<div class="sheet-directive typewriter-ink">' + schema.directive + '</div>';

        html += '<div class="paper-opt-list">';
        schema.options.forEach((opt, idx) => {
          const isSelected = (step === 1 && WIZARD_STATE.capability === opt.label) ||
                             (step === 2 && WIZARD_STATE.velocity === opt.label) ||
                             (step === 3 && WIZARD_STATE.capital === opt.label);

          const boxText = isSelected ? '[ ✓ ]' : '[   ]';
          const rowClass = isSelected ? 'option-row selected typewriter-ink' : (idx === this.focusedIndex ? 'option-row focused typewriter-ink' : 'option-row typewriter-ink');

          html += '<div class="' + rowClass + '" data-idx="' + idx + '" data-val="' + opt.label + '">';
          html += '  <div class="opt-head">';
          html += '    <span class="option-box">' + boxText + '</span>';
          html += '    <span class="opt-num-label">[' + opt.num + '] ' + opt.label + '</span>';
          html += '  </div>';
          html += '  <div class="opt-brief">Brief: ' + opt.brief + '</div>';
          html += '</div>';
        });
        html += '</div>';

        html += '<div class="sheet-footer-bar typewriter-ink">';
        html += '  <span>' + schema.footerStamp + '</span>';
        html += '</div>';

        if (step === 1) this.selectedOption = WIZARD_STATE.capability;
        if (step === 2) this.selectedOption = WIZARD_STATE.velocity;
        if (step === 3) this.selectedOption = WIZARD_STATE.capital;

      } else if (step === 4) {
        // Step 4: 04 // DISPATCH & DELIVERY DETAILS
        const schema = WIZARD_SCHEMA[4];

        html += '<div class="sheet-meta-bar typewriter-ink">';
        html += '  <span>' + schema.tag + ' // ' + schema.ref + '</span>';
        html += '  <span>' + schema.stepLabel + '</span>';
        html += '</div>';

        html += '<div class="sheet-directive typewriter-ink">' + schema.directive + '</div>';

        html += '<div class="paper-form-box typewriter-ink">';

        html += '  <div class="field-row">';
        html += '    <span class="field-lbl">[+] FULL NAME:</span>';
        html += '    <input id="leadName" class="ledger-line typewriter-ink" placeholder="First &amp; Last Name *" value="' + (WIZARD_STATE.clientName || '') + '" autocomplete="name" />';
        html += '  </div>';

        html += '  <div class="field-row">';
        html += '    <span class="field-lbl">[+] WORK EMAIL:</span>';
        html += '    <input id="leadEmail" type="email" class="ledger-line typewriter-ink" placeholder="name@company.com *" value="' + (WIZARD_STATE.clientEmail || '') + '" autocomplete="email" />';
        html += '  </div>';

        html += '  <div class="field-row">';
        html += '    <span class="field-lbl">[+] COMPANY NAME &amp; WEBSITE:</span>';
        html += '    <input id="leadPhone" type="text" class="ledger-line typewriter-ink" placeholder="company.com" value="' + (WIZARD_STATE.clientPhone || '') + '" />';
        html += '  </div>';

        html += '  <div class="field-row-area" style="margin-top: 2px;">';
        html += '    <span class="field-lbl" style="display: block; margin-bottom: 2px;">[+] ADDITIONAL CONTEXT (OPTIONAL):</span>';
        html += '    <textarea id="teamMessage" class="paper-textarea typewriter-ink" rows="2" placeholder="Any existing documentation, Loom links, or specific constraints?">' + (WIZARD_STATE.teamMessage || '') + '</textarea>';
        html += '  </div>';

        html += '  <button id="submitLedger" class="dispatch-action-btn typewriter-ink">';
        html += '    [ REVIEW SUMMARY BEFORE SENDING ↵ ]';
        html += '  </button>';

        html += '</div>';

        html += '<div class="sheet-footer-bar typewriter-ink">';
        html += '  <span>04 // DISPATCH &amp; DELIVERY DETAILS</span>';
        html += '  <span>[ ENTER ↵ TO REVIEW ]</span>';
        html += '</div>';
      }

      this.paperContent.innerHTML = html;
      this.bindPaperInteractions();
      this.updateOptionVisuals();
    }

    bindPaperInteractions() {
      const rows = this.paperContent.querySelectorAll('.option-row');
      rows.forEach((row, idx) => {
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          this.engageMechanicalTerminal();
          const wasSelected = (row.dataset.val === this.selectedOption);
          this.focusedIndex = idx;

          if (wasSelected) {
            this.executePaperAdvance();
          } else {
            this.selectCurrentOption();
          }
        });
      });

      const pName = document.getElementById('leadName');
      const pEmail = document.getElementById('leadEmail');
      const pPhone = document.getElementById('leadPhone');
      const messageInput = document.getElementById('teamMessage');
      const transmitBtn = document.getElementById('submitLedger');

      if (pName) {
        pName.addEventListener('input', () => { WIZARD_STATE.clientName = pName.value; });
      }
      if (pEmail) {
        pEmail.addEventListener('input', () => { WIZARD_STATE.clientEmail = pEmail.value; });
      }
      if (pPhone) {
        pPhone.addEventListener('input', () => { WIZARD_STATE.clientPhone = pPhone.value; });
      }

      if (messageInput) {
        let lineShiftY = this.paperScrollY || 0;
        let prevLineCount = 1;

        messageInput.addEventListener('input', () => {
          WIZARD_STATE.teamMessage = messageInput.value;
          WIZARD_STATE.clientNotes = messageInput.value;

          // Auto expand height
          messageInput.style.height = 'auto';
          messageInput.style.height = messageInput.scrollHeight + 'px';

          // Count visual lines
          const lines = Math.floor(messageInput.scrollHeight / 15);
          if (lines > prevLineCount) {
            lineShiftY -= 14; // Shift paper up by 1 line height
            this.paperScrollY = lineShiftY;
            if (this.typewriterPaper) {
              this.typewriterPaper.style.transform = 'translateY(' + lineShiftY + 'px)';
            }
            AudioEngine.playPaperSlideSound();
            prevLineCount = lines;
          }
        });

        messageInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            if (!e.shiftKey) {
              // Plain Enter: Confirm message, lock focus, and highlight Transmit button
              e.preventDefault();
              AudioEngine.playKeySound('select');
              messageInput.blur();

              if (transmitBtn) {
                transmitBtn.focus();
                transmitBtn.classList.add('ring-2', 'ring-amber-400');
              }
            } else {
              // Shift + Enter: Add line break and ratchet paper upwards
              lineShiftY -= 14;
              this.paperScrollY = lineShiftY;
              const paper = document.getElementById('typewriterPaper');
              if (paper) paper.style.transform = 'translateY(' + lineShiftY + 'px)';
              AudioEngine.playPaperSlideSound();
            }
          }
        });
      }

      if (transmitBtn) {
        transmitBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openFullFrameReview();
        });
      }
    }

    // ========================================================================
    // 7. MULTI-PAPER DESK SPREAD REVIEW & MATRIX WEBHOOK DISPATCH
    // ========================================================================
    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    openFullFrameReview() {
      if (this.isRolling) return;

      const pName = document.getElementById('leadName');
      const pEmail = document.getElementById('leadEmail');
      const pPhone = document.getElementById('leadPhone');
      const pMessage = document.getElementById('teamMessage');

      const name = pName ? pName.value.trim() : (WIZARD_STATE.clientName || '').trim();
      const email = pEmail ? pEmail.value.trim() : (WIZARD_STATE.clientEmail || '').trim();
      const phone = pPhone ? pPhone.value.trim() : (WIZARD_STATE.clientPhone || '').trim();
      const message = pMessage ? pMessage.value.trim() : (WIZARD_STATE.teamMessage || WIZARD_STATE.clientNotes || '').trim();

      WIZARD_STATE.clientName = name;
      WIZARD_STATE.clientEmail = email;
      WIZARD_STATE.clientPhone = phone;
      WIZARD_STATE.clientNotes = message;
      WIZARD_STATE.teamMessage = message;

      let hasError = false;
      if (!name) {
        if (pName) pName.classList.add('field-error');
        hasError = true;
      } else {
        if (pName) pName.classList.remove('field-error');
      }

      if (!email || !email.includes('@')) {
        if (pEmail) pEmail.classList.add('field-error');
        hasError = true;
      } else {
        if (pEmail) pEmail.classList.remove('field-error');
      }

      if (hasError) {
        this.sound.playJam();
        if (this.typewriterPaper) {
          this.typewriterPaper.classList.add('shake');
          setTimeout(() => this.typewriterPaper.classList.remove('shake'), 350);
        }
        return;
      }

      // 1. Play return005.wav for Enter / submit action
      this.sound.playReturnSound();

      // Hide top HUD so it never overlaps spread header
      const topHud = document.querySelector('.top-hud');
      if (topHud) {
        topHud.style.display = 'none';
      }

      // 2. Roll paper backwards/down into platen roller
      this.isRolling = true;
      this.sound.playPaperRollSound();
      if (this.typewriterPaper) {
        this.typewriterPaper.classList.add('paper-ejecting');
      }

      // 3. Populate all 4 sheets in the full frame spread with briefs and change buttons
      this.populateFullFrameReview();

      // 4. After paper rolls back, spread all 4 sheets across the full frame
      setTimeout(() => {
        if (this.fullFrameReview) {
          this.fullFrameReview.classList.add('active');
          this.sound.playPaperRollSound();
        }
        this.isRolling = false;
      }, 420);
    }

    closeFullFrameReview() {
      if (this.fullFrameReview) {
        this.fullFrameReview.classList.remove('active');
      }
      const topHud = document.querySelector('.top-hud');
      if (topHud) topHud.style.display = '';
      this.sound.playPaperRollSound();
      if (this.typewriterPaper) {
        this.typewriterPaper.classList.remove('paper-ejecting');
        this.typewriterPaper.classList.add('paper-loading-in');
        void this.typewriterPaper.offsetWidth;
        setTimeout(() => {
          this.typewriterPaper.classList.remove('paper-loading-in');
          this.typewriterPaper.classList.add('paper-resting');
        }, 320);
      }
    }

    closeFullFrameReviewAndJumpToStep(targetStep) {
      if (this.fullFrameReview) {
        this.fullFrameReview.classList.remove('active');
      }
      const topHud = document.querySelector('.top-hud');
      if (topHud) topHud.style.display = '';
      this.sound.playPaperRollSound();

      if (this.typewriterPaper) {
        this.typewriterPaper.classList.remove('paper-ejecting');
        this.typewriterPaper.classList.add('paper-loading-in');
        void this.typewriterPaper.offsetWidth;
      }

      setTimeout(() => {
        WIZARD_STATE.step = targetStep;
        if (targetStep === 1) this.selectedOption = WIZARD_STATE.capability;
        if (targetStep === 2) this.selectedOption = WIZARD_STATE.velocity;
        if (targetStep === 3) this.selectedOption = WIZARD_STATE.capital;
        if (targetStep === 4) this.selectedOption = null;

        this.focusedIndex = 0;
        this.paperScrollY = 0;
        this.renderPaperStep(targetStep);

        if (this.typewriterPaper) {
          this.typewriterPaper.classList.remove('paper-loading-in');
          this.typewriterPaper.classList.add('paper-resting');
        }
      }, 320);
    }

    populateFullFrameReview() {
      // Sheet 1: 01 // SYSTEM & WORKFLOW SCOPE
      const s1 = WIZARD_SCHEMA[1];
      const sheet1El = document.getElementById('review-sheet-1');
      if (s1 && sheet1El) {
        let h1 = '<div class="sheet-head">';
        h1 += '  <div class="sheet-head-meta">' + s1.tag + ' // ' + s1.stepLabel + '</div>';
        h1 += '  <div class="sheet-head-title">' + s1.directive + '</div>';
        h1 += '</div>';
        h1 += '<div class="sheet-body-options">';
        s1.options.forEach((opt) => {
          const isSel = (WIZARD_STATE.capability === opt.label);
          h1 += '<div class="sheet-opt-row ' + (isSel ? 'active-chosen' : 'muted-unselected') + '">';
          h1 += '  <div class="sheet-opt-header-line">';
          h1 += '    <span class="sheet-opt-box">' + (isSel ? '[ ✓ ]' : '[   ]') + '</span>';
          h1 += '    <span class="sheet-opt-text">[' + opt.num + '] ' + opt.label + '</span>';
          h1 += '  </div>';
          if (isSel) {
            h1 += '  <div class="sheet-opt-brief"><strong>Brief:</strong> ' + opt.brief + '</div>';
          }
          h1 += '</div>';
        });
        h1 += '</div>';
        h1 += '<div class="sheet-card-action">';
        h1 += '  <button class="sheet-change-btn" data-step="1">[ ↺ CHANGE SCOPE ]</button>';
        h1 += '</div>';
        h1 += '<div class="sheet-footer">';
        h1 += '  <span>RECORD: 01-SCOPE</span>';
        h1 += '  <span>STATUS: ' + (WIZARD_STATE.capability ? 'CONFIGURED ✓' : 'PENDING') + '</span>';
        h1 += '</div>';
        sheet1El.innerHTML = h1;
      }

      // Sheet 2: 02 // TIMELINE & TARGET DEPLOYMENT
      const s2 = WIZARD_SCHEMA[2];
      const sheet2El = document.getElementById('review-sheet-2');
      if (s2 && sheet2El) {
        let h2 = '<div class="sheet-head">';
        h2 += '  <div class="sheet-head-meta">' + s2.tag + ' // ' + s2.stepLabel + '</div>';
        h2 += '  <div class="sheet-head-title">' + s2.directive + '</div>';
        h2 += '</div>';
        h2 += '<div class="sheet-body-options">';
        s2.options.forEach((opt) => {
          const isSel = (WIZARD_STATE.velocity === opt.label);
          h2 += '<div class="sheet-opt-row ' + (isSel ? 'active-chosen' : 'muted-unselected') + '">';
          h2 += '  <div class="sheet-opt-header-line">';
          h2 += '    <span class="sheet-opt-box">' + (isSel ? '[ ✓ ]' : '[   ]') + '</span>';
          h2 += '    <span class="sheet-opt-text">[' + opt.num + '] ' + opt.label + '</span>';
          h2 += '  </div>';
          if (isSel) {
            h2 += '  <div class="sheet-opt-brief"><strong>Brief:</strong> ' + opt.brief + '</div>';
          }
          h2 += '</div>';
        });
        h2 += '</div>';
        h2 += '<div class="sheet-card-action">';
        h2 += '  <button class="sheet-change-btn" data-step="2">[ ↺ CHANGE TIMELINE ]</button>';
        h2 += '</div>';
        h2 += '<div class="sheet-footer">';
        h2 += '  <span>RECORD: 02-TIMELINE</span>';
        h2 += '  <span>STATUS: ' + (WIZARD_STATE.velocity ? 'CONFIGURED ✓' : 'PENDING') + '</span>';
        h2 += '</div>';
        sheet2El.innerHTML = h2;
      }

      // Sheet 3: 03 // SCOPE & BUDGET ALLOCATION
      const s3 = WIZARD_SCHEMA[3];
      const sheet3El = document.getElementById('review-sheet-3');
      if (s3 && sheet3El) {
        let h3 = '<div class="sheet-head">';
        h3 += '  <div class="sheet-head-meta">' + s3.tag + ' // ' + s3.stepLabel + '</div>';
        h3 += '  <div class="sheet-head-title">' + s3.directive + '</div>';
        h3 += '</div>';
        h3 += '<div class="sheet-body-options">';
        s3.options.forEach((opt) => {
          const isSel = (WIZARD_STATE.capital === opt.label);
          h3 += '<div class="sheet-opt-row ' + (isSel ? 'active-chosen' : 'muted-unselected') + '">';
          h3 += '  <div class="sheet-opt-header-line">';
          h3 += '    <span class="sheet-opt-box">' + (isSel ? '[ ✓ ]' : '[   ]') + '</span>';
          h3 += '    <span class="sheet-opt-text">[' + opt.num + '] ' + opt.label + '</span>';
          h3 += '  </div>';
          if (isSel) {
            h3 += '  <div class="sheet-opt-brief"><strong>Brief:</strong> ' + opt.brief + '</div>';
          }
          h3 += '</div>';
        });
        h3 += '</div>';
        h3 += '<div class="sheet-card-action">';
        h3 += '  <button class="sheet-change-btn" data-step="3">[ ↺ CHANGE BUDGET ]</button>';
        h3 += '</div>';
        h3 += '<div class="sheet-footer">';
        h3 += '  <span>RECORD: 03-BUDGET</span>';
        h3 += '  <span>STATUS: ' + (WIZARD_STATE.capital ? 'CONFIGURED ✓' : 'PENDING') + '</span>';
        h3 += '</div>';
        sheet3El.innerHTML = h3;
      }

      // Sheet 4: 04 // DISPATCH & DELIVERY DETAILS
      const s4 = WIZARD_SCHEMA[4];
      const sheet4El = document.getElementById('review-sheet-4');
      if (s4 && sheet4El) {
        let h4 = '<div class="sheet-head">';
        h4 += '  <div class="sheet-head-meta">' + s4.tag + ' // ' + s4.stepLabel + '</div>';
        h4 += '  <div class="sheet-head-title">' + s4.directive + '</div>';
        h4 += '</div>';
        h4 += '<div class="sheet-body-options">';
        h4 += '  <div class="sheet-field-row">';
        h4 += '    <div class="sheet-field-label">[+] FULL NAME:</div>';
        h4 += '    <div class="sheet-field-val">' + this.escapeHtml(WIZARD_STATE.clientName || 'NOT SPECIFIED') + '</div>';
        h4 += '  </div>';
        h4 += '  <div class="sheet-field-row">';
        h4 += '    <div class="sheet-field-label">[+] WORK EMAIL:</div>';
        h4 += '    <div class="sheet-field-val">' + this.escapeHtml(WIZARD_STATE.clientEmail || 'NOT SPECIFIED') + '</div>';
        h4 += '  </div>';
        h4 += '  <div class="sheet-field-row">';
        h4 += '    <div class="sheet-field-label">[+] COMPANY / WEBSITE:</div>';
        h4 += '    <div class="sheet-field-val">' + this.escapeHtml(WIZARD_STATE.clientPhone || 'NOT PROVIDED') + '</div>';
        h4 += '  </div>';
        h4 += '  <div class="sheet-field-row">';
        h4 += '    <div class="sheet-field-label">[+] ADDITIONAL CONTEXT:</div>';
        h4 += '    <div class="sheet-field-message">' + this.escapeHtml(WIZARD_STATE.teamMessage || 'NO ADDITIONAL CONTEXT') + '</div>';
        h4 += '  </div>';
        h4 += '  <div class="sheet-stamp-box">DIRECT ENGINEERING REVIEW // STRICT NDA COMPLIANCE</div>';
        h4 += '</div>';
        h4 += '<div class="sheet-card-action">';
        h4 += '  <button class="sheet-change-btn" data-step="4">[ ↺ EDIT DISPATCH DETAILS ]</button>';
        h4 += '</div>';
        h4 += '<div class="sheet-footer">';
        h4 += '  <span>RECORD: 04-DISPATCH</span>';
        h4 += '  <span>STATUS: READY FOR TRANSMISSION</span>';
        h4 += '</div>';
        sheet4El.innerHTML = h4;
      }

      // Bind click handlers to change buttons
      if (this.fullFrameReview) {
        const changeBtns = this.fullFrameReview.querySelectorAll('.sheet-change-btn');
        changeBtns.forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            const stepNum = parseInt(btn.dataset.step, 10);
            if (stepNum) this.closeFullFrameReviewAndJumpToStep(stepNum);
          };
        });

        // Clicking on cards also allows direct jump
        for (let i = 1; i <= 4; i++) {
          const card = this.fullFrameReview.querySelector('.review-sheet.sheet-' + i);
          if (card) {
            card.onclick = (e) => {
              if (!e.target.closest('button')) {
                this.closeFullFrameReviewAndJumpToStep(i);
              }
            };
          }
        }
      }
    }

    async finalizeMatrixDispatch() {
      if (this.reviewConfirmBtn) {
        this.reviewConfirmBtn.disabled = true;
        this.reviewConfirmBtn.textContent = 'SUBMITTING SPECIFICATION...';
      }

      this.sound.playReturnSound();

      // Show red transmitted rubber stamp
      if (this.transmittedStamp) {
        this.transmittedStamp.classList.add('stamped');
      }

      const payload = {
        timestamp: new Date().toISOString(),
        // Client Contact & Notes
        name: WIZARD_STATE.clientName || '',
        clientName: WIZARD_STATE.clientName || '',
        email: WIZARD_STATE.clientEmail || '',
        clientEmail: WIZARD_STATE.clientEmail || '',
        phone: WIZARD_STATE.clientPhone || '',
        clientPhone: WIZARD_STATE.clientPhone || '',
        whatsapp: WIZARD_STATE.clientPhone || '',
        notes: WIZARD_STATE.teamMessage || WIZARD_STATE.clientNotes || '',
        projectNotes: WIZARD_STATE.teamMessage || WIZARD_STATE.clientNotes || '',
        teamMessage: WIZARD_STATE.teamMessage || WIZARD_STATE.clientNotes || '',

        // Selected Options & Descriptions
        capability: WIZARD_STATE.capability || 'Not Specified',
        capabilityBrief: WIZARD_STATE.capabilityBrief || '',
        goal: WIZARD_STATE.capability || 'Not Specified',
        goalBrief: WIZARD_STATE.capabilityBrief || '',

        velocity: WIZARD_STATE.velocity || 'Not Specified',
        velocityBrief: WIZARD_STATE.velocityBrief || '',
        timeline: WIZARD_STATE.velocity || 'Not Specified',
        timelineBrief: WIZARD_STATE.velocityBrief || '',

        capital: WIZARD_STATE.capital || 'Not Specified',
        capitalBrief: WIZARD_STATE.capitalBrief || '',
        budget: WIZARD_STATE.capital || 'Not Specified',
        budgetBrief: WIZARD_STATE.capitalBrief || '',

        // Nested Records for Structured N8N Workflows
        client: {
          name: WIZARD_STATE.clientName || '',
          email: WIZARD_STATE.clientEmail || '',
          phone: WIZARD_STATE.clientPhone || '',
          notes: WIZARD_STATE.teamMessage || WIZARD_STATE.clientNotes || '',
          teamMessage: WIZARD_STATE.teamMessage || WIZARD_STATE.clientNotes || ''
        },
        specification: {
          capability: WIZARD_STATE.capability || 'Not Specified',
          capabilityBrief: WIZARD_STATE.capabilityBrief || '',
          velocity: WIZARD_STATE.velocity || 'Not Specified',
          velocityBrief: WIZARD_STATE.velocityBrief || '',
          capital: WIZARD_STATE.capital || 'Not Specified',
          capitalBrief: WIZARD_STATE.capitalBrief || ''
        },
        meta: {
          userAgent: navigator.userAgent,
          terminalModel: 'Royal Teletype 1954'
        }
      };

      const webhookUrl = window.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/a9393481-aa8c-46bd-9335-4abdf388aba1';

      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload),
            mode: 'no-cors'
          });
        } catch (_) {}
      }

      setTimeout(() => {
        if (this.fullFrameReview) {
          this.fullFrameReview.classList.remove('active');
        }
        if (this.reviewConfirmBtn) {
          this.reviewConfirmBtn.disabled = false;
          this.reviewConfirmBtn.textContent = 'SUBMIT SPECIFICATION FOR TECHNICAL AUDIT ↵';
        }
        if (this.transmittedStamp) {
          this.transmittedStamp.classList.remove('stamped');
        }
        this.renderPaperReceipt(payload);
        this.showSummaryModal(payload);
      }, 700);
    }

    dispatchSpecification() {
      this.openFullFrameReview();
    }

    renderPaperReceipt(payload) {
      let html = '';
      html += '<div class="sheet-meta-bar typewriter-ink">';
      html += '  <span>AUDIT QUEUED // SPECIFICATION INTAKE</span>';
      html += '  <span>STATUS: ROUTED TO ENGINEERING</span>';
      html += '</div>';

      html += '<div class="sheet-directive typewriter-ink">SPECIFICATION AUDIT // CONFIRMATION RECEIPT</div>';

      html += '<div style="font-size: 10px; line-height: 1.5; color: #0F172A; margin-top: 4px;" class="typewriter-ink">';
      html += '  <div><strong>CONTACT:</strong> ' + payload.client.name + '</div>';
      html += '  <div><strong>WORK EMAIL:</strong> ' + payload.client.email + '</div>';
      html += '  <div><strong>COMPANY / WEB:</strong> ' + (payload.client.phone || 'N/A') + '</div>';
      html += '  <div style="margin-top: 6px; border-top: 1px dashed rgba(15,23,42,0.3); padding-top: 4px;">';
      html += '    <div><strong>[ OBJECTIVE ]:</strong> ' + payload.specification.capability + '</div>';
      html += '    <div><strong>[ TIMELINE ]:</strong> ' + payload.specification.velocity + '</div>';
      html += '    <div><strong>[ BUDGET ]:</strong> ' + payload.specification.capital + '</div>';
      if (payload.client.teamMessage) {
        html += '    <div><strong>[ CONTEXT ]:</strong> ' + payload.client.teamMessage + '</div>';
      }
      html += '  </div>';
      html += '</div>';

      html += '<button id="newTransmissionBtn" class="dispatch-action-btn typewriter-ink" style="margin-top: 10px;">';
      html += '  [ NEW SPECIFICATION / RESET ]';
      html += '</button>';

      html += '<div class="sheet-footer-bar typewriter-ink" style="margin-top: 8px;">';
      html += '  <span>ENTERPRISE SPECIFICATION AUDIT</span>';
      html += '  <span>AUDIT ID: ' + Math.random().toString(36).substring(2, 8).toUpperCase() + '</span>';
      html += '</div>';

      this.paperContent.innerHTML = html;

      const resetBtn = document.getElementById('newTransmissionBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => this.resetToStep1());
      }
    }

    showSummaryModal(payload) {
      if (!this.summaryModal) return;

      const ledgerRecords = document.getElementById('ledger-records');
      const ledgerTimestamp = document.getElementById('ledger-timestamp');

      if (ledgerTimestamp) {
        ledgerTimestamp.textContent = 'DATE: ' + new Date().toISOString().replace('T', ' // ').substring(0, 22) + ' UTC';
      }

      if (ledgerRecords) {
        let recHtml = '';
        recHtml += '<div class="ledger-confirmation-notice" style="font-size: 11px; line-height: 1.5; color: #166534; background: rgba(34, 197, 94, 0.08); border-left: 3px solid #16a34a; padding: 9px 12px; margin-bottom: 12px;">Your project parameters have been routed directly to our automation engineering team. We are running feasibility checks on your selected tech stack and will email your preliminary n8n architecture map within 24 business hours.</div>';
        recHtml += '<div class="ledger-row"><span class="ledger-key">PRIMARY OBJECTIVE:</span><span class="ledger-val highlight">' + payload.specification.capability + '</span></div>';
        if (payload.specification.capabilityBrief) {
          recHtml += '<div class="ledger-row" style="margin-top:-3px;margin-bottom:6px;"><span class="ledger-key">SCOPE BRIEF:</span><span class="ledger-val" style="font-size:9.5px;color:#57534E;font-style:italic;">' + payload.specification.capabilityBrief + '</span></div>';
        }
        recHtml += '<div class="ledger-row"><span class="ledger-key">TARGET DEPLOYMENT:</span><span class="ledger-val highlight">' + payload.specification.velocity + '</span></div>';
        if (payload.specification.velocityBrief) {
          recHtml += '<div class="ledger-row" style="margin-top:-3px;margin-bottom:6px;"><span class="ledger-key">TIMELINE BRIEF:</span><span class="ledger-val" style="font-size:9.5px;color:#57534E;font-style:italic;">' + payload.specification.velocityBrief + '</span></div>';
        }
        recHtml += '<div class="ledger-row"><span class="ledger-key">BUDGET ALLOCATION:</span><span class="ledger-val highlight">' + payload.specification.capital + '</span></div>';
        if (payload.specification.capitalBrief) {
          recHtml += '<div class="ledger-row" style="margin-top:-3px;margin-bottom:6px;"><span class="ledger-key">BUDGET BRIEF:</span><span class="ledger-val" style="font-size:9.5px;color:#57534E;font-style:italic;">' + payload.specification.capitalBrief + '</span></div>';
        }
        recHtml += '<div class="ledger-row"><span class="ledger-key">DISPATCH CONTACT:</span><span class="ledger-val">' + payload.client.name + ' // ' + (payload.client.phone || 'NO COMPANY/WEB') + ' // ' + payload.client.email + '</span></div>';
        if (payload.client.teamMessage) {
          recHtml += '<div class="ledger-row"><span class="ledger-key">ADDITIONAL CONTEXT:</span><span class="ledger-val">' + payload.client.teamMessage + '</span></div>';
        }
        ledgerRecords.innerHTML = recHtml;
      }

      this.summaryModal.classList.add('active');

      const copyBtn = document.getElementById('copy-summary-btn');
      const newBtn = document.getElementById('new-trans-btn');

      if (copyBtn) {
        copyBtn.onclick = () => {
          this.copySummaryToClipboard();
          copyBtn.textContent = 'COPIED TO CLIPBOARD';
          setTimeout(() => { copyBtn.textContent = 'COPY SUBMISSION SUMMARY'; }, 2000);
        };
      }

      if (newBtn) {
        newBtn.onclick = () => {
          this.summaryModal.classList.remove('active');
          this.resetToStep1();
        };
      }
    }

    resetToStep1() {
      WIZARD_STATE.step = 1;
      WIZARD_STATE.capability = null;
      WIZARD_STATE.velocity = null;
      WIZARD_STATE.capital = null;
      WIZARD_STATE.clientName = '';
      WIZARD_STATE.clientEmail = '';
      WIZARD_STATE.clientPhone = '';
      WIZARD_STATE.clientNotes = '';
      WIZARD_STATE.teamMessage = '';

      this.selectedOption = null;
      this.focusedIndex = 0;
      this.paperScrollY = 0;

      this.sound.playPaperRollSound();
      if (this.typewriterPaper) {
        this.typewriterPaper.style.transform = '';
        this.typewriterPaper.classList.add('paper-ejecting');
      }

      setTimeout(() => {
        this.renderPaperStep(1);
        if (this.typewriterPaper) {
          this.typewriterPaper.classList.remove('paper-ejecting');
          this.typewriterPaper.classList.add('paper-loading-in');
          void this.typewriterPaper.offsetWidth;
          this.typewriterPaper.classList.remove('paper-loading-in');
          this.typewriterPaper.classList.add('paper-resting');
        }
        this.isRolling = false;
      }, 440);
    }

    copySummaryToClipboard() {
      let output = '=== ENTERPRISE AUTOMATION AUDIT // SPECIFICATION ===\n';
      output += 'TIMESTAMP: ' + new Date().toISOString() + '\n\n';
      output += '[ CONTACT ] ' + (WIZARD_STATE.clientName || 'UNKNOWN') + '\n';
      output += '[ WORK EMAIL ] ' + (WIZARD_STATE.clientEmail || 'N/A') + '\n';
      output += '[ COMPANY / WEBSITE ] ' + (WIZARD_STATE.clientPhone || 'N/A') + '\n\n';
      output += '[ PRIMARY OBJECTIVE ] ' + (WIZARD_STATE.capability || 'N/A') + '\n';
      output += '[ TARGET DEPLOYMENT ] ' + (WIZARD_STATE.velocity || 'N/A') + '\n';
      output += '[ BUDGET ALLOCATION ] ' + (WIZARD_STATE.capital || 'N/A') + '\n';
      if (WIZARD_STATE.teamMessage) {
        output += '[ ADDITIONAL CONTEXT ] ' + WIZARD_STATE.teamMessage + '\n';
      }
      output += '\nYour project parameters have been routed directly to our automation engineering team. We are running feasibility checks on your selected tech stack and will email your preliminary n8n architecture map within 24 business hours.\n';
      output += '====================================================';

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(output).catch(() => {});
      }
    }
  }

  // Ensure AudioContext is unlocked & running on very first user gesture anywhere
  const unlockAudioGesture = () => {
    AudioEngine.unlock();
  };
  ['pointerdown', 'mousedown', 'keydown', 'touchstart', 'click'].forEach((evt) => {
    window.addEventListener(evt, unlockAudioGesture, { capture: true, passive: true });
    document.addEventListener(evt, unlockAudioGesture, { capture: true, passive: true });
  });

  // ==========================================================================
  // 8. BOOTSTRAP TELETYPE ON DOM READY
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    const engine = new TypewriterEngine();
    engine.init();
    window.teletypeEngine = engine;
  });

})();
