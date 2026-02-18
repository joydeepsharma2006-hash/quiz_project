// ============================================================
//  quiz.js  –  Quiz App Frontend Logic
//
//  This file talks to the Python/Flask backend via fetch() calls.
//  All answer checking happens on the server – not here.
// ============================================================

// ── State variables ──────────────────────────────────────────
let questions    = [];   // array of question objects from the server
let currentIndex = 0;   // which question we're on (0-based)
let totalQuestions = 0;
let answered     = false; // prevent double-clicking an option

// ── Utility: show / hide screens ─────────────────────────────
function showScreen(id) {
  ["setup-screen", "loading-screen", "quiz-screen", "results-screen"].forEach(s => {
    document.getElementById(s).classList.add("hidden");
  });
  document.getElementById(id).classList.remove("hidden");
}

// ── EVENT LISTENERS ──────────────────────────────────────────

// Start Quiz button
document.getElementById("start-btn").addEventListener("click", startQuiz);

// Next Question button
document.getElementById("next-btn").addEventListener("click", nextQuestion);

// Play Again button
document.getElementById("play-again-btn").addEventListener("click", () => {
  showScreen("setup-screen");
});

// Review toggle button
document.getElementById("review-toggle-btn").addEventListener("click", () => {
  const list = document.getElementById("review-list");
  list.classList.toggle("hidden");
  document.getElementById("review-toggle-btn").textContent =
    list.classList.contains("hidden") ? "📋 View My Answers" : "📋 Hide Answers";
});


// ════════════════════════════════════════════════════════════
//  STEP 1 – FETCH QUESTIONS FROM PYTHON BACKEND
// ════════════════════════════════════════════════════════════
async function startQuiz() {
  const category   = document.getElementById("category").value;
  const difficulty = document.getElementById("difficulty").value;
  const amount     = document.getElementById("num-questions").value;

  // Reset state
  questions = []; currentIndex = 0;

  // Hide any old errors
  const errEl = document.getElementById("setup-error");
  errEl.textContent = "";
  errEl.classList.add("hidden");

  showScreen("loading-screen");

  try {
    // Call our Flask backend – it fetches from Open Trivia DB and cleans the data
    const res  = await fetch(`/get_questions?category=${category}&difficulty=${difficulty}&amount=${amount}`);
    const data = await res.json();

    if (data.error) {
      throw new Error(data.error);
    }

    questions      = data.questions;
    totalQuestions = questions.length;

    showScreen("quiz-screen");
    renderQuestion();

  } catch (err) {
    showScreen("setup-screen");
    errEl.textContent = "❌ " + (err.message || "Something went wrong. Try again.");
    errEl.classList.remove("hidden");
  }
}


// ════════════════════════════════════════════════════════════
//  STEP 2 – RENDER CURRENT QUESTION
// ════════════════════════════════════════════════════════════
function renderQuestion() {
  answered = false;

  const q = questions[currentIndex];

  // ── Progress bar ──
  const pct = (currentIndex / totalQuestions) * 100;
  document.getElementById("progress-fill").style.width = pct + "%";
  document.getElementById("progress-label").textContent =
    `Question ${currentIndex + 1} of ${totalQuestions}`;

  // ── Question meta ──
  document.getElementById("q-category").textContent = q.category;

  const diffEl = document.getElementById("q-difficulty");
  diffEl.textContent  = q.difficulty;
  diffEl.className    = "q-difficulty " + q.difficulty; // sets colour class

  // ── Question text ──
  document.getElementById("q-text").textContent = q.question;

  // ── Answer options ──
  const grid = document.getElementById("options-grid");
  grid.innerHTML = ""; // clear previous options

  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className  = "option-btn";
    btn.textContent = opt;
    btn.addEventListener("click", () => selectAnswer(opt, btn));
    grid.appendChild(btn);
  });

  // ── Reset feedback & next button ──
  const fb = document.getElementById("feedback-box");
  fb.className = "feedback-box hidden";
  fb.textContent = "";

  const nextBtn = document.getElementById("next-btn");
  nextBtn.classList.add("hidden");
}


// ════════════════════════════════════════════════════════════
//  STEP 3 – SEND ANSWER TO PYTHON BACKEND & SHOW FEEDBACK
// ════════════════════════════════════════════════════════════
async function selectAnswer(chosen, clickedBtn) {
  if (answered) return; // ignore extra clicks
  answered = true;

  // Disable all option buttons while we wait for the server
  document.querySelectorAll(".option-btn").forEach(b => b.disabled = true);

  try {
    // POST the chosen answer to Flask
    const res = await fetch("/check_answer", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index: currentIndex, answer: chosen }),
    });
    const result = await res.json();

    // ── Colour the buttons ──
    document.querySelectorAll(".option-btn").forEach(btn => {
      if (btn.textContent === result.correct) {
        btn.classList.add("correct");        // green: right answer
      } else if (btn === clickedBtn && !result.is_right) {
        btn.classList.add("wrong");          // red: wrong choice
      }
    });

    // ── Feedback message ──
    const fb = document.getElementById("feedback-box");
    fb.classList.remove("hidden");

    if (result.is_right) {
      fb.className = "feedback-box correct";
      fb.textContent = "✅ Correct! Great job!";
    } else {
      fb.className = "feedback-box wrong";
      fb.textContent = `❌ Wrong! The correct answer was: ${result.correct}`;
    }

    // ── Next / Finish button ──
    const nextBtn = document.getElementById("next-btn");
    nextBtn.classList.remove("hidden");
    nextBtn.textContent = (currentIndex === totalQuestions - 1)
      ? "See Results 🏁"
      : "Next Question →";

  } catch (err) {
    alert("Network error. Please refresh the page.");
  }
}


// ════════════════════════════════════════════════════════════
//  STEP 4 – MOVE TO NEXT QUESTION OR SHOW RESULTS
// ════════════════════════════════════════════════════════════
function nextQuestion() {
  currentIndex++;
  if (currentIndex >= totalQuestions) {
    loadResults();
  } else {
    renderQuestion();
  }
}


// ════════════════════════════════════════════════════════════
//  STEP 5 – FETCH & DISPLAY FINAL RESULTS
// ════════════════════════════════════════════════════════════
async function loadResults() {
  try {
    const res  = await fetch("/get_results");
    const data = await res.json();

    showScreen("results-screen");
    displayResults(data);

  } catch (err) {
    alert("Could not load results. Please refresh.");
  }
}

function displayResults(data) {
  const { score, total, user_answers } = data;
  const pct = Math.round((score / total) * 100);

  // ── Score circle ──
  document.getElementById("score-fraction").textContent = `${score}/${total}`;

  // ── Grade ──
  let grade = "F";
  if (pct >= 90) grade = "A+";
  else if (pct >= 80) grade = "A";
  else if (pct >= 70) grade = "B";
  else if (pct >= 60) grade = "C";
  else if (pct >= 50) grade = "D";

  document.getElementById("grade-tag").textContent = `Grade: ${grade}  •  ${pct}%`;

  // ── Motivational message ──
  let msg = "";
  if (pct === 100) msg = "🔥 Perfect score! You're a genius!";
  else if (pct >= 80) msg = "🌟 Excellent work! You really know your stuff!";
  else if (pct >= 60) msg = "👍 Good effort! A bit more practice and you'll ace it!";
  else if (pct >= 40) msg = "📚 Keep studying — you'll improve!";
  else                msg = "💪 Don't give up! Try again and see how much better you do!";

  document.getElementById("result-message").textContent = msg;

  // ── Build review list ──
  const list = document.getElementById("review-list");
  list.innerHTML = "";

  user_answers.forEach((a, i) => {
    const item = document.createElement("div");
    item.className = `review-item ${a.is_right ? "r-correct" : "r-wrong"}`;

    const badge = `<span class="r-badge ${a.is_right ? "correct" : "wrong"}">${a.is_right ? "✓ Correct" : "✗ Wrong"}</span>`;

    item.innerHTML = `
      <div class="r-q">Q${i + 1}. ${a.question} ${badge}</div>
      <div class="r-your" style="color: ${a.is_right ? "#43e97b" : "#f75c66"}">
        Your answer: <strong>${a.chosen}</strong>
      </div>
      ${!a.is_right
        ? `<div class="r-correct-ans">✔ Correct answer: <strong>${a.correct}</strong></div>`
        : ""}
    `;
    list.appendChild(item);
  });
}