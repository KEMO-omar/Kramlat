/**
 * إمبراطورية كرملات الفضائية | Unified System Engine
 * Provides Web Audio synth, Particle canvas, Firebase RTDB sync & State engine
 */

(function() {
  'use strict';

  // =========================================================================
  // 1. WEB AUDIO SYNTHESIZER ENGINE (Zero external sound lag, pure Web Audio)
  // =========================================================================
  const audioState = {
    enabled: localStorage.getItem('kramlat_sound') !== 'muted',
    ctx: null
  };

  function getAudioCtx() {
    if (!audioState.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioState.ctx = new AudioCtx();
      }
    }
    if (audioState.ctx && audioState.ctx.state === 'suspended') {
      audioState.ctx.resume();
    }
    return audioState.ctx;
  }

  const KramlatAudio = {
    toggle: function() {
      audioState.enabled = !audioState.enabled;
      localStorage.setItem('kramlat_sound', audioState.enabled ? 'on' : 'muted');
      KramlatAudio.updateUI();
      if (audioState.enabled) {
        KramlatAudio.playSuccess();
        KramlatUI.toast('تم تفعيل المؤثرات الصوتية 🔊');
      } else {
        KramlatUI.toast('تم كتم الصوت 🔇');
      }
      return audioState.enabled;
    },
    updateUI: function() {
      const widget = document.getElementById('kramlatSoundWidget');
      if (widget) {
        const icon = widget.querySelector('.k-sound-icon');
        const text = widget.querySelector('.k-sound-text');
        if (icon) icon.className = audioState.enabled ? 'fas fa-volume-high k-sound-icon' : 'fas fa-volume-xmark k-sound-icon';
        if (text) text.innerText = audioState.enabled ? 'الصوت مفعّل' : 'مكتوم';
      }
    },
    playTone: function(freq, type, duration, gainVal) {
      if (!audioState.enabled) return;
      try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(gainVal || 0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {
        // Audio error ignored safely
      }
    },
    playClick: function() {
      KramlatAudio.playTone(600, 'triangle', 0.08, 0.1);
    },
    playPop: function() {
      if (!audioState.enabled) return;
      try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } catch(e) {}
    },
    playSuccess: function() {
      if (!audioState.enabled) return;
      KramlatAudio.playTone(523.25, 'sine', 0.12, 0.15); // C5
      setTimeout(() => KramlatAudio.playTone(659.25, 'sine', 0.12, 0.15), 80); // E5
      setTimeout(() => KramlatAudio.playTone(783.99, 'sine', 0.22, 0.18), 160); // G5
      setTimeout(() => KramlatAudio.playTone(1046.50, 'sine', 0.35, 0.2), 240); // C6
    },
    playError: function() {
      if (!audioState.enabled) return;
      KramlatAudio.playTone(220, 'sawtooth', 0.15, 0.12);
      setTimeout(() => KramlatAudio.playTone(180, 'sawtooth', 0.25, 0.12), 100);
    },
    playVictory: function() {
      if (!audioState.enabled) return;
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      notes.forEach((f, idx) => {
        setTimeout(() => KramlatAudio.playTone(f, 'triangle', 0.3, 0.2), idx * 110);
      });
    }
  };

  // =========================================================================
  // 2. UNIFIED STATE & CHALLENGES MANAGER (Local + Firebase RTDB Dual Mode)
  // =========================================================================
  const DEFAULT_CONFIG = {
    counterText: "عيد سعيد",
    activeChallenge: "crazy_button", // "crazy_button" | "code_breaker" | "candy_reflex" | "trivia_quest" | "anagram_quest"
    challenges: {
      crazy_button: {
        id: "crazy_button",
        title: "لغز الزرار المجنون",
        subtitle: "الزرار الصح بيتحرك بسرعة جنونية.. هتلحقه قبل ما الوقت يخلص؟",
        icon: "fa-crosshairs",
        enabled: true,
        difficulty: "متوسط",
        secretCode: "7",
        targetPoints: 100
      },
      code_breaker: {
        id: "code_breaker",
        title: "فك الشفرة الكونية (Mastermind)",
        subtitle: "شفرة سرية من 4 أرقام مخفية في الفضاء.. خمّن وحلل الإشارات الضوئية!",
        icon: "fa-terminal",
        enabled: true,
        difficulty: "تحدي ذكاء",
        secretCode: "2026",
        targetPoints: 250
      },
      candy_reflex: {
        id: "candy_reflex",
        title: "صائد الكرملات السريع",
        subtitle: "اختبر سرعة رد فعلك واصطد أكبر عدد من الكرملات الطائرة خلال 30 ثانية!",
        icon: "fa-bolt-lightning",
        enabled: true,
        difficulty: "سرعة ومهارة",
        secretCode: "88",
        targetPoints: 300
      },
      trivia_quest: {
        id: "trivia_quest",
        title: "سؤال المليون كرملة",
        subtitle: "اختبار معلومات وأسرار إمبراطورية كرملات.. جاوب صح واجمع نقاط المجد!",
        icon: "fa-brain",
        enabled: true,
        difficulty: "معلومات",
        secretCode: "99",
        targetPoints: 150
      },
      anagram_quest: {
        id: "anagram_quest",
        title: "لغز الكلمة الضائعة",
        subtitle: "فك تشفير الحروف المبعثرة واكتشف الكلمة السرية للمجرة!",
        icon: "fa-spell-check",
        enabled: true,
        difficulty: "أذكياء",
        secretCode: "KRAMLAT",
        targetPoints: 200
      }
    },
    ad: {
      visible: true,
      image: "/src/assets/images/cosmic_space_banner_1791739327163.jpg",
      text: "🚀 الموسم الأسطوري الجديد 2026 بدأ الآن! تحديات كبرى وجوائز نارية تنتظر الأبطال.",
      link: "join.html"
    },
    competition: {
      status: "open", // "open" | "closed" | "review"
      title: "بطولة كرملات الكبرى 2026 👑",
      subtitle: "المعركة الحاسمة لتتويج ملوك المجرة",
      desc: "سجل بياناتك وانضم للتصفيات المباشرة والتحديات الفردية والجماعية.",
      whatsappGroup: "https://whatsapp.com/channel/0029VbAqgz23WHTOe8lXeM1N"
    },
    hall_of_fame: {
      hero1: { name: "جودة", title: "تاج المجرة 👑", score: 980 },
      hero2: { name: "سراچ", title: "نجم الفضاء ⭐", score: 920 },
      hero3: { name: "حمزة", title: "صاعقة التحديات ⚡", score: 870 },
      hero4: { name: "عبدالله", title: "شعلة الإمبراطورية 🔥", score: 840 }
    }
  };

  const KramlatState = {
    get: function() {
      try {
        const local = localStorage.getItem('kramlat_admin_cache');
        if (local) {
          const parsed = JSON.parse(local);
          return Object.assign({}, DEFAULT_CONFIG, parsed);
        }
      } catch (e) {}
      return DEFAULT_CONFIG;
    },
    save: function(newData) {
      try {
        localStorage.setItem('kramlat_admin_cache', JSON.stringify(newData));
        // If Firebase is available, sync to RTDB
        if (window.firebase && window.firebase.database) {
          window.firebase.database().ref('admin_control').update(newData).catch(err => {
            console.log('Firebase RTDB update note:', err);
          });
        }
      } catch (e) {
        console.error('State save error:', e);
      }
    },
    subscribe: function(callback) {
      // 1. Initial trigger from cache
      callback(KramlatState.get());

      // 2. Realtime listener from Firebase if active
      if (window.firebase && window.firebase.database) {
        try {
          window.firebase.database().ref('admin_control').on('value', snap => {
            const val = snap.val();
            if (val) {
              const merged = Object.assign({}, KramlatState.get(), val);
              localStorage.setItem('kramlat_admin_cache', JSON.stringify(merged));
              callback(merged);
            }
          });
        } catch (e) {}
      }

      // 3. Storage event listener for cross-tab updates (e.g. admin panel in another tab)
      window.addEventListener('storage', (e) => {
        if (e.key === 'kramlat_admin_cache') {
          callback(KramlatState.get());
        }
      });
    }
  };

  // =========================================================================
  // 3. TOAST & PARTICLES ENGINE
  // =========================================================================
  const KramlatUI = {
    toast: function(msg, icon) {
      let toastEl = document.getElementById('k-toast');
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.id = 'k-toast';
        document.body.appendChild(toastEl);
      }
      toastEl.innerHTML = `<i class="${icon || 'fa-solid fa-sparkles'}"></i> <span>${msg}</span>`;
      toastEl.classList.add('show');
      clearTimeout(toastEl._timer);
      toastEl._timer = setTimeout(() => {
        toastEl.classList.remove('show');
      }, 3000);
    },
    confetti: function(x, y) {
      if (window._kramlatCanvasExplode) {
        window._kramlatCanvasExplode(x || window.innerWidth / 2, y || window.innerHeight / 2);
      }
    }
  };

  // =========================================================================
  // 4. COSMOS CANVAS INITIALIZER
  // =========================================================================
  function initCosmos() {
    const canvas = document.getElementById('cosmos') || document.querySelector('canvas.k-cosmos-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    // Cosmic stars
    const stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.8 + 0.6,
        alpha: Math.random() * 0.8 + 0.2,
        speed: Math.random() * 0.3 + 0.05
      });
    }

    // Interactive particles for explosion & trails
    const particles = [];
    class Particle {
      constructor(px, py, isConfetti) {
        this.x = px;
        this.y = py;
        const angle = Math.random() * Math.PI * 2;
        const speed = isConfetti ? Math.random() * 12 + 4 : Math.random() * 3 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.alpha = 1;
        this.size = isConfetti ? Math.random() * 4 + 2 : Math.random() * 2 + 1;
        this.color = ['#ff007f', '#00f0ff', '#b9ff00', '#ffd700', '#ffffff'][Math.floor(Math.random() * 5)];
        this.decay = isConfetti ? Math.random() * 0.015 + 0.01 : 0.02;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.08; // subtle gravity
        this.alpha -= this.decay;
      }
      draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    window._kramlatCanvasExplode = function(ex, ey) {
      for (let i = 0; i < 60; i++) {
        particles.push(new Particle(ex, ey, true));
      }
    };

    function loop() {
      ctx.clearRect(0, 0, width, height);

      // Draw distant stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.y -= s.speed;
        if (s.y < 0) s.y = height;
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw();
        if (p.alpha <= 0) particles.splice(i, 1);
      }

      requestAnimationFrame(loop);
    }
    loop();

    // Mouse movement trail (subtle)
    let lastMove = 0;
    window.addEventListener('mousemove', (e) => {
      const now = Date.now();
      if (now - lastMove > 70 && particles.length < 90) {
        particles.push(new Particle(e.clientX, e.clientY, false));
        lastMove = now;
      }
    });
  }

  // Auto mount audio widget if not present
  document.addEventListener('DOMContentLoaded', () => {
    initCosmos();

    if (!document.getElementById('kramlatSoundWidget')) {
      const widget = document.createElement('div');
      widget.id = 'kramlatSoundWidget';
      widget.className = 'k-sound-widget';
      widget.title = 'تفعيل أو كتم الصوت';
      widget.innerHTML = `
        <i class="${audioState.enabled ? 'fas fa-volume-high' : 'fas fa-volume-xmark'} k-sound-icon"></i>
        <span class="k-sound-text">${audioState.enabled ? 'الصوت مفعّل' : 'مكتوم'}</span>
      `;
      widget.addEventListener('click', () => {
        KramlatAudio.toggle();
      });
      document.body.appendChild(widget);
    }
  });

  // Expose to window
  window.KramlatAudio = KramlatAudio;
  window.KramlatState = KramlatState;
  window.KramlatUI = KramlatUI;
})();
