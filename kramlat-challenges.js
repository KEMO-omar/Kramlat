/**
 * إمبراطورية كرملات الفضائية | Interactive Challenges Engine
 * Powers the 5 Galactic Challenges with sound FX, score recording & admin sync
 */

(function() {
  'use strict';

  const ChallengesEngine = {
    currentChallengeId: null,
    score: 0,

    // Initialize the arena inside a container element
    mount: function(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const state = window.KramlatState ? window.KramlatState.get() : {};
      const activeId = state.activeChallenge || 'crazy_button';
      ChallengesEngine.renderSelector(container, activeId);
    },

    renderSelector: function(container, defaultActiveId) {
      const state = window.KramlatState ? window.KramlatState.get() : {};
      const challenges = state.challenges || {};

      let html = `
        <div class="k-challenges-wrapper">
          <!-- Filter Tabs / Mode Switcher -->
          <div class="k-challenges-tabs" id="kChallengesTabs">
      `;

      Object.keys(challenges).forEach(key => {
        const c = challenges[key];
        const isSelected = key === defaultActiveId;
        const isDisabled = c.enabled === false;
        html += `
          <button 
            type="button" 
            class="k-challenge-tab-btn ${isSelected ? 'active' : ''} ${isDisabled ? 'disabled' : ''}" 
            data-id="${key}"
            ${isDisabled ? 'disabled' : ''}
            onclick="KramlatChallenges.switchGame('${key}')">
            <i class="fas ${c.icon || 'fa-gamepad'}"></i>
            <span>${c.title}</span>
            ${isDisabled ? '<span class="k-tab-lock"><i class="fas fa-lock"></i> مغلق</span>' : ''}
          </button>
        `;
      });

      html += `
          </div>
          <!-- Game Play Area -->
          <div class="k-game-stage" id="kGameStage"></div>
        </div>
      `;

      container.innerHTML = html;
      ChallengesEngine.switchGame(defaultActiveId);
    },

    switchGame: function(id) {
      const state = window.KramlatState ? window.KramlatState.get() : {};
      const challenge = (state.challenges && state.challenges[id]) ? state.challenges[id] : null;
      if (!challenge || challenge.enabled === false) {
        if (window.KramlatUI) window.KramlatUI.toast('هذا التحدي مغلق حالياً من القيادة 🔒');
        return;
      }

      ChallengesEngine.currentChallengeId = id;
      if (window.KramlatAudio) window.KramlatAudio.playClick();

      // Update tabs UI
      document.querySelectorAll('.k-challenge-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-id') === id);
      });

      const stage = document.getElementById('kGameStage');
      if (!stage) return;

      // Dispatch to specific challenge builder
      switch (id) {
        case 'crazy_button':
          ChallengesEngine.buildCrazyButton(stage, challenge);
          break;
        case 'code_breaker':
          ChallengesEngine.buildCodeBreaker(stage, challenge);
          break;
        case 'candy_reflex':
          ChallengesEngine.buildCandyReflex(stage, challenge);
          break;
        case 'trivia_quest':
          ChallengesEngine.buildTriviaQuest(stage, challenge);
          break;
        case 'anagram_quest':
          ChallengesEngine.buildAnagramQuest(stage, challenge);
          break;
        default:
          ChallengesEngine.buildCrazyButton(stage, challenge);
      }
    },

    // -----------------------------------------------------------------------
    // GAME 1: لغز الزرار المجنون (Crazy Button)
    // -----------------------------------------------------------------------
    buildCrazyButton: function(stage, challenge) {
      stage.innerHTML = `
        <div class="k-game-card">
          <div class="k-game-header">
            <div>
              <h3><i class="fas fa-crosshairs" style="color:var(--k-primary)"></i> ${challenge.title}</h3>
              <p class="k-game-desc">${challenge.subtitle}</p>
            </div>
            <div class="k-game-hud">
              <div class="k-hud-item"><span class="k-hud-label">الوقت:</span> <span id="cbTimer" class="k-hud-val k-num">30</span>ث</div>
              <div class="k-hud-item"><span class="k-hud-label">القلوب:</span> <span id="cbHearts" class="k-hud-val">❤️❤️❤️</span></div>
            </div>
          </div>

          <div class="k-progress-bar"><div class="k-progress-fill" id="cbProgress" style="width:100%"></div></div>

          <div class="k-cb-matrix" id="cbGrid">
            ${Array.from({length: 9}).map((_, i) => `
              <button type="button" class="k-cb-cell" data-idx="${i}" onclick="KramlatChallenges.handleCbClick(${i})">
                <i class="fas fa-circle-dot"></i>
                <span>اضغط هنا</span>
              </button>
            `).join('')}
          </div>

          <div class="k-game-footer">
            <button type="button" class="k-btn k-btn-accent" id="cbStartBtn" onclick="KramlatChallenges.startCrazyButton()">
              <i class="fas fa-play"></i> بدء التحدي
            </button>
            <div id="cbMsg" class="k-game-status">اضغط على زر البدء واستعد للمطاردة!</div>
          </div>
        </div>
      `;
      ChallengesEngine._cbActive = false;
    },

    startCrazyButton: function() {
      if (window.KramlatAudio) window.KramlatAudio.playSuccess();
      const state = window.KramlatState ? window.KramlatState.get() : {};
      const challenge = (state.challenges && state.challenges.crazy_button) || {};
      const secret = challenge.secretCode || "7";

      let lives = 3;
      let timeLeft = 30;
      let targetIdx = Math.floor(Math.random() * 9);
      let speed = 1600;
      let moveTimer = null;
      let clockTimer = null;

      ChallengesEngine._cbActive = true;
      document.getElementById('cbStartBtn').style.display = 'none';
      document.getElementById('cbMsg').innerText = '🔥 الزرار بيهرب! راقبه واصطاده!';

      const updateHearts = () => {
        document.getElementById('cbHearts').innerText = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
      };
      updateHearts();

      const moveTarget = () => {
        if (!ChallengesEngine._cbActive) return;
        let newIdx;
        do {
          newIdx = Math.floor(Math.random() * 9);
        } while(newIdx === targetIdx);
        targetIdx = newIdx;

        const cells = document.querySelectorAll('.k-cb-cell');
        cells.forEach((c, idx) => {
          c.classList.remove('target-flash');
          if (idx === targetIdx) {
            c.classList.add('target-flash');
          }
        });
      };
      moveTarget();

      moveTimer = setInterval(moveTarget, speed);

      clockTimer = setInterval(() => {
        if (!ChallengesEngine._cbActive) {
          clearInterval(clockTimer);
          clearInterval(moveTimer);
          return;
        }
        timeLeft--;
        document.getElementById('cbTimer').innerText = timeLeft;
        document.getElementById('cbProgress').style.width = ((timeLeft / 30) * 100) + '%';

        if (timeLeft % 7 === 0 && speed > 700) {
          speed -= 250;
          clearInterval(moveTimer);
          moveTimer = setInterval(moveTarget, speed);
        }

        if (timeLeft <= 0) {
          ChallengesEngine._cbActive = false;
          clearInterval(clockTimer);
          clearInterval(moveTimer);
          if (window.KramlatAudio) window.KramlatAudio.playError();
          document.getElementById('cbMsg').innerHTML = '⏰ انتهى الوقت! حاول مرة أخرى.';
          document.getElementById('cbStartBtn').style.display = 'inline-flex';
          document.getElementById('cbStartBtn').innerText = 'إعادة المحاولة 🔄';
        }
      }, 1000);

      ChallengesEngine._cbHandler = (clickedIdx) => {
        if (!ChallengesEngine._cbActive) return;

        if (clickedIdx === targetIdx) {
          // VICTORY!
          ChallengesEngine._cbActive = false;
          clearInterval(clockTimer);
          clearInterval(moveTimer);
          if (window.KramlatAudio) window.KramlatAudio.playVictory();
          if (window.KramlatUI) window.KramlatUI.confetti();

          const cells = document.querySelectorAll('.k-cb-cell');
          cells[clickedIdx].classList.add('cell-win');
          document.getElementById('cbMsg').innerHTML = `
            <div class="k-win-box">
              🎉 <b>مبروك يا أسطورة!</b> مسكت الزرار الصح!<br>
              الرقم السري للمرحلة هو: <span class="k-secret-tag">${secret}</span>
            </div>
          `;
          document.getElementById('cbStartBtn').style.display = 'inline-flex';
          document.getElementById('cbStartBtn').innerText = 'العب جولة تانية 🔥';
        } else {
          // WRONG
          lives--;
          updateHearts();
          if (window.KramlatAudio) window.KramlatAudio.playError();
          const cells = document.querySelectorAll('.k-cb-cell');
          cells[clickedIdx].classList.add('cell-wrong');
          setTimeout(() => cells[clickedIdx].classList.remove('cell-wrong'), 300);

          moveTarget();

          if (lives <= 0) {
            ChallengesEngine._cbActive = false;
            clearInterval(clockTimer);
            clearInterval(moveTimer);
            document.getElementById('cbMsg').innerHTML = '💀 نفدت محاولاتك! الزرار كان أسرع منك!';
            document.getElementById('cbStartBtn').style.display = 'inline-flex';
            document.getElementById('cbStartBtn').innerText = 'حاول تاني يا بطل 🔄';
          }
        }
      };
    },

    handleCbClick: function(idx) {
      if (ChallengesEngine._cbHandler) {
        ChallengesEngine._cbHandler(idx);
      }
    },

    // -----------------------------------------------------------------------
    // GAME 2: فك الشفرة الكونية (Code Breaker / Mastermind)
    // -----------------------------------------------------------------------
    buildCodeBreaker: function(stage, challenge) {
      const state = window.KramlatState ? window.KramlatState.get() : {};
      const c = (state.challenges && state.challenges.code_breaker) || challenge;
      const targetCode = c.secretCode || "2026";

      stage.innerHTML = `
        <div class="k-game-card">
          <div class="k-game-header">
            <div>
              <h3><i class="fas fa-terminal" style="color:var(--k-secondary)"></i> ${challenge.title}</h3>
              <p class="k-game-desc">${challenge.subtitle}</p>
            </div>
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap">
              <a href="mastermind.html" class="k-btn k-btn-accent k-btn-sm" style="box-shadow:0 0 14px rgba(255,0,128,0.4)">
                <i class="fas fa-swords"></i> <span>العب أونلاين 1 ضد 1 مع صاحبك ⚔️</span>
              </a>
              <div class="k-hud-item"><span class="k-hud-label">المحاولات:</span> <span id="codAttempts" class="k-hud-val k-num">6 / 6</span></div>
            </div>
          </div>

          <div class="k-code-legend">
            <span class="k-legend-item"><span class="k-dot green"></span> رقم ومكان صحيح</span>
            <span class="k-legend-item"><span class="k-dot yellow"></span> رقم صحيح مكان خاطئ</span>
            <span class="k-legend-item"><span class="k-dot red"></span> رقم غير موجود</span>
          </div>

          <div class="k-code-history" id="codeHistory">
            <div class="k-code-hint-row">أدخل 4 أرقام واضغط "اختبار الشفرة" لكشف الإشارات الضوئية.</div>
          </div>

          <div class="k-code-input-bar">
            <div class="k-digit-slots">
              <input type="text" maxlength="1" class="k-code-digit" id="cd0" inputmode="numeric">
              <input type="text" maxlength="1" class="k-code-digit" id="cd1" inputmode="numeric">
              <input type="text" maxlength="1" class="k-code-digit" id="cd2" inputmode="numeric">
              <input type="text" maxlength="1" class="k-code-digit" id="cd3" inputmode="numeric">
            </div>
            <button type="button" class="k-btn k-btn-cyan" onclick="KramlatChallenges.submitCodeGuess('${targetCode}')">
              <i class="fas fa-fingerprint"></i> اختبار الشفرة
            </button>
          </div>
          <div id="codeStatus" class="k-game-status"></div>
        </div>
      `;

      // Auto focus jump between digits
      [0, 1, 2, 3].forEach(i => {
        const inp = document.getElementById(`cd${i}`);
        if (!inp) return;
        inp.addEventListener('input', (e) => {
          if (inp.value && i < 3) {
            document.getElementById(`cd${i+1}`).focus();
          }
        });
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !inp.value && i > 0) {
            document.getElementById(`cd${i-1}`).focus();
          }
        });
      });

      ChallengesEngine._codeTries = 6;
      ChallengesEngine._codeHistory = [];
    },

    submitCodeGuess: function(targetCode) {
      if (ChallengesEngine._codeTries <= 0) return;

      const d0 = document.getElementById('cd0').value.trim();
      const d1 = document.getElementById('cd1').value.trim();
      const d2 = document.getElementById('cd2').value.trim();
      const d3 = document.getElementById('cd3').value.trim();

      const guess = `${d0}${d1}${d2}${d3}`;
      if (guess.length !== 4) {
        if (window.KramlatUI) window.KramlatUI.toast('يرجى ملء الخانات الأربعة بالأرقام! ⚠️');
        return;
      }

      if (window.KramlatAudio) window.KramlatAudio.playClick();

      // Evaluate clue
      const targetArr = targetCode.split('');
      const guessArr = guess.split('');
      const clues = [];

      for (let i = 0; i < 4; i++) {
        if (guessArr[i] === targetArr[i]) {
          clues.push({ digit: guessArr[i], state: 'green' });
        } else if (targetArr.includes(guessArr[i])) {
          clues.push({ digit: guessArr[i], state: 'yellow' });
        } else {
          clues.push({ digit: guessArr[i], state: 'red' });
        }
      }

      ChallengesEngine._codeTries--;
      document.getElementById('codAttempts').innerText = `${ChallengesEngine._codeTries} / 6`;

      // Render history row
      const histEl = document.getElementById('codeHistory');
      const row = document.createElement('div');
      row.className = 'k-code-row';
      row.innerHTML = `
        <div class="k-guess-digits">
          ${clues.map(c => `<span class="k-guess-digit ${c.state}">${c.digit}</span>`).join('')}
        </div>
        <div class="k-clue-label">محاولة #${6 - ChallengesEngine._codeTries}</div>
      `;
      histEl.appendChild(row);
      histEl.scrollTop = histEl.scrollHeight;

      // Clear inputs
      [0, 1, 2, 3].forEach(i => document.getElementById(`cd${i}`).value = '');
      document.getElementById('cd0').focus();

      // Check win
      if (guess === targetCode) {
        if (window.KramlatAudio) window.KramlatAudio.playVictory();
        if (window.KramlatUI) window.KramlatUI.confetti();
        document.getElementById('codeStatus').innerHTML = `
          <div class="k-win-box">
            👑 <b>تم فك الشفرة بنجاح!</b> أنت عبقري استراتيجي!<br>
            رمز التحدي المكتشف: <span class="k-secret-tag">${targetCode}</span>
          </div>
        `;
        ChallengesEngine._codeTries = 0;
      } else if (ChallengesEngine._codeTries <= 0) {
        if (window.KramlatAudio) window.KramlatAudio.playError();
        document.getElementById('codeStatus').innerHTML = `
          <div class="k-lose-box">
            💀 انتهت محاولاتك! الشفرة الصحيحة كانت: <b>${targetCode}</b>
          </div>
        `;
      }
    },

    // -----------------------------------------------------------------------
    // GAME 3: صائد الكرملات السريع (Candy Reflex Tap)
    // -----------------------------------------------------------------------
    buildCandyReflex: function(stage, challenge) {
      stage.innerHTML = `
        <div class="k-game-card">
          <div class="k-game-header">
            <div>
              <h3><i class="fas fa-bolt-lightning" style="color:var(--k-accent)"></i> ${challenge.title}</h3>
              <p class="k-game-desc">${challenge.subtitle}</p>
            </div>
            <div class="k-game-hud">
              <div class="k-hud-item"><span class="k-hud-label">النقاط:</span> <span id="crScore" class="k-hud-val k-num">0</span></div>
              <div class="k-hud-item"><span class="k-hud-label">الوقت:</span> <span id="crTimer" class="k-hud-val k-num">30</span>ث</div>
            </div>
          </div>

          <div class="k-reflex-arena" id="crArena">
            <div class="k-arena-placeholder">
              <i class="fas fa-hand-pointer" style="font-size:3rem; color:var(--k-secondary); margin-bottom:15px"></i>
              <h4>اصطد الكرملات السريعة!</h4>
              <p>كل كرملة تمنحك +10 نقاط، والكرملة الذهبية تمنحك +30 نقطة!</p>
              <button type="button" class="k-btn k-btn-accent" onclick="KramlatChallenges.startCandyReflex()">
                <i class="fas fa-play"></i> انطلاق الجولة
              </button>
            </div>
          </div>
        </div>
      `;
    },

    startCandyReflex: function() {
      const arena = document.getElementById('crArena');
      if (!arena) return;

      if (window.KramlatAudio) window.KramlatAudio.playSuccess();
      arena.innerHTML = '';

      let score = 0;
      let timeLeft = 30;
      let gameActive = true;

      document.getElementById('crScore').innerText = '0';
      document.getElementById('crTimer').innerText = '30';

      const spawnCandy = () => {
        if (!gameActive) return;

        const candy = document.createElement('div');
        candy.className = 'k-flying-candy';

        const isGolden = Math.random() < 0.2;
        if (isGolden) candy.classList.add('golden');

        const emojis = ['🍭', '🍬', '🪐', '🧁', '⭐'];
        candy.innerText = isGolden ? '👑' : emojis[Math.floor(Math.random() * emojis.length)];

        const x = Math.random() * (arena.clientWidth - 60);
        const y = Math.random() * (arena.clientHeight - 60);
        candy.style.left = `${Math.max(10, x)}px`;
        candy.style.top = `${Math.max(10, y)}px`;

        candy.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!gameActive) return;
          if (window.KramlatAudio) window.KramlatAudio.playPop();

          const pts = isGolden ? 30 : 10;
          score += pts;
          document.getElementById('crScore').innerText = score;

          // Float point text
          const ptEl = document.createElement('div');
          ptEl.className = 'k-score-float';
          ptEl.innerText = `+${pts}`;
          ptEl.style.left = `${e.clientX}px`;
          ptEl.style.top = `${e.clientY}px`;
          document.body.appendChild(ptEl);
          setTimeout(() => ptEl.remove(), 700);

          candy.remove();
        });

        arena.appendChild(candy);

        // Candy stays for 1.2 to 2.2 seconds then vanishes
        setTimeout(() => {
          if (candy.parentNode) candy.remove();
        }, isGolden ? 1200 : 1800);
      };

      const spawner = setInterval(spawnCandy, 650);

      const timer = setInterval(() => {
        timeLeft--;
        const timerEl = document.getElementById('crTimer');
        if (timerEl) timerEl.innerText = timeLeft;

        if (timeLeft <= 0) {
          gameActive = false;
          clearInterval(spawner);
          clearInterval(timer);

          if (window.KramlatAudio) window.KramlatAudio.playVictory();
          if (window.KramlatUI) window.KramlatUI.confetti();

          arena.innerHTML = `
            <div class="k-arena-placeholder">
              <i class="fas fa-trophy" style="font-size:3.5rem; color:var(--k-gold); margin-bottom:15px"></i>
              <h3>جولة استثنائية!</h3>
              <p style="font-size:1.3rem; font-weight:900; color:#fff">حققت <span style="color:var(--k-accent)">${score}</span> نقطة في 30 ثانية!</p>
              <button type="button" class="k-btn k-btn-accent" onclick="KramlatChallenges.startCandyReflex()">
                <i class="fas fa-redo"></i> العب مجدداً
              </button>
            </div>
          `;
        }
      }, 1000);
    },

    // -----------------------------------------------------------------------
    // GAME 4: سؤال المليون كرملة (Trivia Quest)
    // -----------------------------------------------------------------------
    buildTriviaQuest: function(stage, challenge) {
      const questions = [
        {
          q: "من هو المؤسس وصاحب الرؤية المعمارية الأولى لإمبراطورية كرملات؟",
          opts: ["كريم عمر (البلدوزر)", "العميل شريف", "العبقري مصطفى", "جودة"],
          ans: 0
        },
        {
          q: "ما هو الشعار الرسمي الأبرز لجمهورية كرملات؟",
          opts: ["حيث لا مكان للملل.. تحكم الفوضى الممتعة!", "الهدوء سر النجاح", "ممنوع الضحك", "القراءة للجميع"],
          ans: 0
        },
        {
          q: "في أي عام تم إطلاق موقعة الحسم والموسم الكوني الحالي؟",
          opts: ["2024", "2025", "2026", "2027"],
          ans: 2
        },
        {
          q: "ما هو اللقب الخاص بالقائد شريف سيد داخل الإمبراطورية؟",
          opts: ["المهندس", "العميل", "الكابتن", "السلطان"],
          ans: 1
        }
      ];

      ChallengesEngine._triviaData = { qIdx: 0, score: 0, list: questions };

      stage.innerHTML = `
        <div class="k-game-card">
          <div class="k-game-header">
            <div>
              <h3><i class="fas fa-brain" style="color:var(--k-purple)"></i> ${challenge.title}</h3>
              <p class="k-game-desc">${challenge.subtitle}</p>
            </div>
            <div class="k-game-hud">
              <div class="k-hud-item"><span class="k-hud-label">السؤال:</span> <span id="trvIdx" class="k-hud-val k-num">1 / ${questions.length}</span></div>
              <div class="k-hud-item"><span class="k-hud-label">النقاط:</span> <span id="trvScore" class="k-hud-val k-num">0</span></div>
            </div>
          </div>

          <div class="k-trivia-body" id="triviaBody"></div>
        </div>
      `;

      ChallengesEngine.renderTriviaQuestion();
    },

    renderTriviaQuestion: function() {
      const data = ChallengesEngine._triviaData;
      const body = document.getElementById('triviaBody');
      if (!body) return;

      if (data.qIdx >= data.list.length) {
        if (window.KramlatAudio) window.KramlatAudio.playVictory();
        if (window.KramlatUI) window.KramlatUI.confetti();
        body.innerHTML = `
          <div class="k-win-box" style="text-align:center">
            <h3>🎉 أتممت اختبار المعرفة الكونية!</h3>
            <p>مجموع نقاطك: <b>${data.score} / ${data.list.length * 50}</b></p>
            <button type="button" class="k-btn k-btn-accent" onclick="KramlatChallenges.switchGame('trivia_quest')">
              <i class="fas fa-redo"></i> إعادة الاختبار
            </button>
          </div>
        `;
        return;
      }

      const q = data.list[data.qIdx];
      document.getElementById('trvIdx').innerText = `${data.qIdx + 1} / ${data.list.length}`;
      document.getElementById('trvScore').innerText = `${data.score}`;

      body.innerHTML = `
        <div class="k-question-box">
          <h4>${q.q}</h4>
          <div class="k-opts-grid">
            ${q.opts.map((opt, i) => `
              <button type="button" class="k-opt-btn" onclick="KramlatChallenges.answerTrivia(${i})">
                <span class="k-opt-letter">${['أ', 'ب', 'ج', 'د'][i]}</span>
                <span>${opt}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    },

    answerTrivia: function(pickedIdx) {
      const data = ChallengesEngine._triviaData;
      const q = data.list[data.qIdx];
      const buttons = document.querySelectorAll('.k-opt-btn');

      buttons.forEach(b => b.disabled = true);

      if (pickedIdx === q.ans) {
        if (window.KramlatAudio) window.KramlatAudio.playSuccess();
        buttons[pickedIdx].classList.add('correct');
        data.score += 50;
      } else {
        if (window.KramlatAudio) window.KramlatAudio.playError();
        buttons[pickedIdx].classList.add('wrong');
        buttons[q.ans].classList.add('correct');
      }

      setTimeout(() => {
        data.qIdx++;
        ChallengesEngine.renderTriviaQuestion();
      }, 1200);
    },

    // -----------------------------------------------------------------------
    // GAME 5: لغز الكلمة الضائعة (Anagram Quest)
    // -----------------------------------------------------------------------
    buildAnagramQuest: function(stage, challenge) {
      const puzzles = [
        { word: "كرملات", hint: "اسم الإمبراطورية الكونية الأسطورية" },
        { word: "الفضاء", hint: "عالم النجوم والكواكب والمجرات" },
        { word: "البلدوزر", hint: "لقب المؤسس كريم عمر" }
      ];

      const p = puzzles[0];
      const scrambled = p.word.split('').sort(() => Math.random() - 0.5);

      stage.innerHTML = `
        <div class="k-game-card">
          <div class="k-game-header">
            <div>
              <h3><i class="fas fa-spell-check" style="color:var(--k-gold)"></i> ${challenge.title}</h3>
              <p class="k-game-desc">${challenge.subtitle}</p>
            </div>
          </div>

          <div class="k-anagram-box">
            <div class="k-hint-banner">💡 تلميح: ${p.hint}</div>
            
            <div class="k-scrambled-letters" id="scrambledLetters">
              ${scrambled.map((char, i) => `
                <button type="button" class="k-letter-tile" onclick="KramlatChallenges.pickLetter('${char}', this)">${char}</button>
              `).join('')}
            </div>

            <div class="k-picked-slots" id="pickedSlots">
              <span class="k-picked-placeholder">انقر على الحروف بالترتيب الصحيح لتكوين الكلمة</span>
            </div>

            <div class="k-anagram-controls">
              <button type="button" class="k-btn k-btn-secondary" onclick="KramlatChallenges.resetAnagram()">
                <i class="fas fa-undo"></i> مسح الحروف
              </button>
              <button type="button" class="k-btn k-btn-accent" onclick="KramlatChallenges.checkAnagram('${p.word}')">
                <i class="fas fa-check"></i> تأكيد الكلمة
              </button>
            </div>

            <div id="anagramResult" class="k-game-status"></div>
          </div>
        </div>
      `;

      ChallengesEngine._anagramPicked = [];
    },

    pickLetter: function(char, btn) {
      if (btn.classList.contains('used')) return;
      if (window.KramlatAudio) window.KramlatAudio.playClick();

      btn.classList.add('used');
      ChallengesEngine._anagramPicked.push({ char, btn });

      const slots = document.getElementById('pickedSlots');
      slots.innerHTML = ChallengesEngine._anagramPicked.map(item => `
        <span class="k-slot-char">${item.char}</span>
      `).join('');
    },

    resetAnagram: function() {
      if (window.KramlatAudio) window.KramlatAudio.playClick();
      ChallengesEngine._anagramPicked.forEach(item => item.btn.classList.remove('used'));
      ChallengesEngine._anagramPicked = [];
      document.getElementById('pickedSlots').innerHTML = '<span class="k-picked-placeholder">انقر على الحروف بالترتيب الصحيح لتكوين الكلمة</span>';
      document.getElementById('anagramResult').innerText = '';
    },

    checkAnagram: function(correctWord) {
      const userWord = ChallengesEngine._anagramPicked.map(i => i.char).join('');
      if (userWord === correctWord) {
        if (window.KramlatAudio) window.KramlatAudio.playVictory();
        if (window.KramlatUI) window.KramlatUI.confetti();
        document.getElementById('anagramResult').innerHTML = `
          <div class="k-win-box">
            👑 <b>أحسنت صنعاً!</b> الكلمة صحيحة تماماً: <b>${correctWord}</b>
          </div>
        `;
      } else {
        if (window.KramlatAudio) window.KramlatAudio.playError();
        document.getElementById('anagramResult').innerHTML = `
          <div class="k-lose-box">❌ الكلمة غير صحيحة، حاول مجدداً!</div>
        `;
      }
    }
  };

  window.KramlatChallenges = ChallengesEngine;
})();
