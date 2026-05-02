const REQUIRED_SCORE = 3;
const SPREADSHEET_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzKOk8hCNgnOyaVA2EpTvopdhKrbc5u_F8iKi2b7M7EVg6CsGPck8JzSW5MQKnvpq7R/exec";
const SPREADSHEET_QUEUE_KEY = "f1SpreadsheetQueueV1";

const questions = [
  {
    question: "¿Cuánto se espera que aumente la inversión en patrocinios de Fórmula 1 entre 2025 y 2026?",
    options: [
      "De USD 1,0 a USD 1,5 mil millones",
      "De USD 2,5 a más de USD 3 mil millones",
      "De USD 5 a USD 7 mil millones",
    ],
    answerIndex: 1,
  },
  {
    question: "Un coche de F1 moderno tiene cerca de 300 sensores. ¿Cuántos puntos de datos genera por segundo?",
    options: [
      "10.000 puntos de datos por segundo",
      "100.000 puntos de datos por segundo",
      "Más de 1 millón de puntos de datos por segundo",
    ],
    answerIndex: 2,
  },
  {
    question: "¿Cuál es el rango de precio de un paquete de hospitality F1 Paddock Club de tres días en 2026?",
    options: ["USD 500 a 1.000", "USD 5.500 a 15.399", "USD 30.000 a 50.000"],
    answerIndex: 1,
  },
  {
    question: "En 2025, ¿qué porcentaje de la base total de fans de F1 tenía menos de 35 años y qué porcentaje de los nuevos fans pertenecía a este grupo?",
    options: ["10% y 20%", "43% y 57%", "70% y 80%"],
    answerIndex: 1,
  },
];

let currentQuestionIndex = 0;
let score = 0;
let userData = {};
let isAnswerLocked = false;
let questionCarGoesDown = true;
let isSpreadsheetSyncInFlight = false;

const registrationScreen = document.getElementById("registration");
const preRaceScreen = document.getElementById("prerace");
const quizScreen = document.getElementById("quiz");
const resultsScreen = document.getElementById("results");
const leaderboardScreen = document.getElementById("leaderboard");

const registrationForm = document.getElementById("registration-form");
const firstNameInput = document.getElementById("firstname");
const lastNameInput = document.getElementById("lastname");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");
const questionTitle = document.getElementById("question-title");
const optionsList = document.getElementById("options");
const questionContainer = document.getElementById("question-container");
const answerFeedback = document.getElementById("answer-feedback");
const resultTitle = document.getElementById("result-title");
const scoreText = document.getElementById("score-text");
const rewardText = document.getElementById("reward-text");
const finishBtn = document.getElementById("finish-btn");
const finalLeaderboard = document.getElementById("final-leaderboard");
const restartBtn = document.getElementById("restart-btn");
const countdownText = document.getElementById("countdown-text");
const lightsWrap = document.getElementById("lights-wrap");
const progressText = document.getElementById("progress-text");
const miniScore = document.getElementById("mini-score");
const questionCar = document.getElementById("quiz-car");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadSpreadsheetQueue() {
  try {
    return JSON.parse(localStorage.getItem(SPREADSHEET_QUEUE_KEY) || "[]");
  } catch (error) {
    console.warn("No se pudo leer la cola local de spreadsheet.", error);
    return [];
  }
}

function saveSpreadsheetQueue(queue) {
  localStorage.setItem(SPREADSHEET_QUEUE_KEY, JSON.stringify(queue));
}

function enqueueSpreadsheetPayload(payload) {
  const queue = loadSpreadsheetQueue();
  queue.push(payload);
  saveSpreadsheetQueue(queue);
}

function buildSpreadsheetRequestUrl(payload) {
  const url = new URL(SPREADSHEET_WEB_APP_URL);

  Object.entries(payload).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  url.searchParams.set("_ts", Date.now().toString());
  return url.toString();
}

function sendSpreadsheetPixel(payload) {
  return new Promise((resolve) => {
    const pixel = new Image();
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      resolve(true);
    };

    const timeoutId = window.setTimeout(finish, 1600);

    pixel.onload = finish;
    pixel.onerror = finish;
    pixel.src = buildSpreadsheetRequestUrl(payload);
  });
}

async function postToSpreadsheet(payload) {
  if (!SPREADSHEET_WEB_APP_URL) {
    return false;
  }

  try {
    if (navigator.sendBeacon) {
      const accepted = navigator.sendBeacon(
        SPREADSHEET_WEB_APP_URL,
        JSON.stringify(payload)
      );

      if (accepted) {
        return true;
      }
    }

    return await sendSpreadsheetPixel(payload);
  } catch (error) {
    console.warn("No se pudo enviar el registro al spreadsheet.", error);
    return false;
  }
}

async function flushSpreadsheetQueue() {
  if (isSpreadsheetSyncInFlight || !SPREADSHEET_WEB_APP_URL) {
    return;
  }

  const queue = loadSpreadsheetQueue();
  if (!queue.length) {
    return;
  }

  isSpreadsheetSyncInFlight = true;

  try {
    const pending = [];

    for (const payload of queue) {
      const sent = await postToSpreadsheet(payload);
      if (!sent) {
        pending.push(payload);
      }
    }

    saveSpreadsheetQueue(pending);
  } finally {
    isSpreadsheetSyncInFlight = false;
  }
}

function buildSpreadsheetPayload(firstName, lastName, email, phone) {
  return {
    firstName,
    lastName,
    email,
    phone,
  };
}

function queueParticipantForSpreadsheet(payload) {
  enqueueSpreadsheetPayload(payload);
  void flushSpreadsheetQueue();
}

function showScreen(screen) {
  [registrationScreen, preRaceScreen, quizScreen, resultsScreen, leaderboardScreen].forEach((s) =>
    s.classList.add("hidden")
  );
  screen.classList.remove("hidden");
}

function loadLeaderboard() {
  const data = JSON.parse(localStorage.getItem("f1LeaderBoardV2") || "[]");
  return data.sort((a, b) => {
    const bTotal = b.total || questions.length;
    const aTotal = a.total || questions.length;
    return b.score / bTotal - a.score / aTotal || b.score - a.score;
  });
}

function saveToLeaderboard(name, totalScore) {
  const board = loadLeaderboard();
  board.push({
    name,
    score: totalScore,
    total: questions.length,
    qualified: totalScore >= REQUIRED_SCORE,
  });
  localStorage.setItem("f1LeaderBoardV2", JSON.stringify(board));
}

function displayFinalLeaderboard() {
  finalLeaderboard.innerHTML = "";
  const board = loadLeaderboard();

  if (board.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Sin registros todavía.";
    finalLeaderboard.appendChild(li);
    return;
  }

  board.forEach((entry) => {
    const li = document.createElement("li");
    const entryName = document.createElement("span");
    const badge = document.createElement("span");
    const entryTotal = entry.total || questions.length;
    const qualified = entry.qualified ?? entry.score >= REQUIRED_SCORE;

    li.className = qualified ? "qualified-entry" : "pending-entry";
    entryName.textContent = `${entry.name} — ${entry.score}/${entryTotal}`;
    badge.className = qualified ? "vr-badge" : "retry-badge";
    badge.textContent = qualified ? "Clasificó VR" : "Reintento";

    li.appendChild(entryName);
    li.appendChild(badge);
    finalLeaderboard.appendChild(li);
  });
}

function runQuizCar(direction = "down") {
  if (!questionCar) {
    return;
  }

  questionCar.classList.remove("race-pass-down", "race-pass-up");
  void questionCar.offsetWidth;
  questionCar.classList.add(direction === "up" ? "race-pass-up" : "race-pass-down");
}

async function runLightsCountdown() {
  const lights = document.querySelectorAll(".light");

  lights.forEach((light) => {
    light.classList.remove("active", "out");
  });

  const numericCountdown = [3, 2, 1];
  for (let i = 0; i < numericCountdown.length; i += 1) {
    countdownText.textContent = `${numericCountdown[i]}`;
    lights[i].classList.add("active");
    await delay(900);
  }

  countdownText.textContent = "YA";
  lights.forEach((light) => {
    light.classList.add("active");
  });
  await delay(300);

  lights.forEach((light) => {
    light.classList.remove("active");
    light.classList.add("out");
  });

  await delay(520);

  lights.forEach((light) => light.classList.remove("out"));
  countdownText.textContent = "";
}

async function startPreRaceSequence() {
  lightsWrap.classList.add("hidden");
  countdownText.textContent = "";

  lightsWrap.classList.remove("hidden");
  await runLightsCountdown();
  await delay(250);

  showScreen(quizScreen);
  startQuiz();
}

function updateQuizHud() {
  progressText.textContent = `Pregunta ${currentQuestionIndex + 1}/${questions.length}`;
  miniScore.textContent = `${score}/${REQUIRED_SCORE} para simulador VR`;
  miniScore.classList.toggle("is-qualified", score >= REQUIRED_SCORE);
}

function getFeedbackText(isCorrect) {
  if (isCorrect) {
    return score >= REQUIRED_SCORE
      ? "Correcta. Ya estás en zona de simulador VR."
      : "Correcta. Seguís acelerando hacia la clasificación.";
  }

  const remainingQuestions = questions.length - currentQuestionIndex - 1;
  const canStillQualify = score + remainingQuestions >= REQUIRED_SCORE;
  return canStillQualify
    ? "Todavía podés clasificar. La próxima decisión cuenta."
    : "Te faltó poco, pero podés volver a intentarlo al final.";
}

function displayQuestion() {
  const q = questions[currentQuestionIndex];
  isAnswerLocked = false;
  questionTitle.textContent = q.question;
  optionsList.innerHTML = "";
  answerFeedback.textContent = "";
  answerFeedback.className = "answer-feedback";
  updateQuizHud();

  q.options.forEach((option, idx) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = option;

    btn.addEventListener("click", async () => {
      if (isAnswerLocked) {
        return;
      }

      isAnswerLocked = true;
      const isCorrect = idx === q.answerIndex;
      if (isCorrect) {
        score += 1;
      }

      document.querySelectorAll(".options-list button").forEach((b, buttonIndex) => {
        b.classList.add("locked");
        if (buttonIndex === q.answerIndex) {
          b.classList.add("correct-answer");
        }
      });

      btn.classList.add(isCorrect ? "selected" : "wrong-answer");
      updateQuizHud();
      answerFeedback.textContent = getFeedbackText(isCorrect);
      answerFeedback.classList.add(isCorrect ? "is-correct" : "is-wrong");

      await delay(900);
      questionContainer.classList.add("is-exiting");
      answerFeedback.classList.add("is-exiting");
      await delay(360);

      currentQuestionIndex += 1;
      if (currentQuestionIndex < questions.length) {
        questionContainer.classList.remove("is-exiting");
        answerFeedback.classList.remove("is-exiting");
        displayQuestion();
      } else {
        questionContainer.classList.remove("is-exiting");
        answerFeedback.classList.remove("is-exiting");
        showResults();
      }
    });

    li.appendChild(btn);
    optionsList.appendChild(li);
  });

  runQuizCar(questionCarGoesDown ? "down" : "up");
  questionCarGoesDown = !questionCarGoesDown;
}

function startQuiz() {
  currentQuestionIndex = 0;
  score = 0;
  questionCarGoesDown = true;
  questionContainer.classList.remove("is-exiting");
  answerFeedback.className = "answer-feedback";
  answerFeedback.textContent = "";
  displayQuestion();
}

function showResults() {
  const qualified = score >= REQUIRED_SCORE;

  showScreen(resultsScreen);
  resultTitle.textContent = qualified ? "Clasificaste al simulador VR" : "Te faltó poco";
  scoreText.textContent = `${userData.name}, terminaste con ${score} de ${questions.length} correctas.`;
  rewardText.classList.toggle("qualified", qualified);
  rewardText.textContent = qualified
    ? "Ganaste tu lugar: acercate al equipo para subirte al simulador de Fórmula 1 con realidad virtual."
    : "No desbloqueaste el simulador esta vez, pero podés volver a correr la trivia y buscar la clasificación.";
  saveToLeaderboard(userData.name, score);
}

function validateRegistrationForm() {
  const fname = firstNameInput.value.trim();
  const lname = lastNameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = phoneInput.value.trim();

  const nameRegex = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{2,40}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const phoneCharsRegex = /^[0-9+()\-\s]{8,20}$/;
  const phoneDigits = phone.replace(/\D/g, "");

  firstNameInput.setCustomValidity("");
  lastNameInput.setCustomValidity("");
  emailInput.setCustomValidity("");
  phoneInput.setCustomValidity("");

  if (!fname) {
    firstNameInput.setCustomValidity("Completá tu nombre.");
  } else if (!nameRegex.test(fname)) {
    firstNameInput.setCustomValidity("Ingresá un nombre válido (2 a 40 caracteres, solo letras y espacios).");
  }

  if (!lname) {
    lastNameInput.setCustomValidity("Completá tu apellido.");
  } else if (!nameRegex.test(lname)) {
    lastNameInput.setCustomValidity("Ingresá un apellido válido (2 a 40 caracteres, solo letras y espacios).");
  }

  if (!email) {
    emailInput.setCustomValidity("Completá tu correo electrónico.");
  } else if (email.length > 120) {
    emailInput.setCustomValidity("El correo electrónico no puede superar los 120 caracteres.");
  } else if (!emailRegex.test(email)) {
    emailInput.setCustomValidity("Ingresá un correo electrónico válido.");
  }

  if (!phone) {
    phoneInput.setCustomValidity("Completá tu teléfono.");
  } else if (!phoneCharsRegex.test(phone)) {
    phoneInput.setCustomValidity("Usá solo números y, si querés, +, espacios, paréntesis o guiones.");
  } else if (phoneDigits.length < 8 || phoneDigits.length > 15) {
    phoneInput.setCustomValidity("Ingresá un teléfono válido (8 a 15 dígitos). Podés usar +, espacios, paréntesis o guiones.");
  }

  return (
    firstNameInput.checkValidity() &&
    lastNameInput.checkValidity() &&
    emailInput.checkValidity() &&
    phoneInput.checkValidity()
  );
}

[firstNameInput, lastNameInput, emailInput, phoneInput].forEach((input) => {
  input.addEventListener("invalid", () => {
    validateRegistrationForm();
  });

  input.addEventListener("input", () => {
    input.setCustomValidity("");
  });
});

registrationForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fname = firstNameInput.value.trim();
  const lname = lastNameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = phoneInput.value.trim();

  if (!validateRegistrationForm()) {
    registrationForm.reportValidity();
    return;
  }

  userData = {
    firstName: fname,
    lastName: lname,
    name: `${fname} ${lname}`,
    email,
    phone,
  };

  queueParticipantForSpreadsheet(buildSpreadsheetPayload(fname, lname, email, phone));

  showScreen(preRaceScreen);
  await startPreRaceSequence();
});

finishBtn.addEventListener("click", () => {
  displayFinalLeaderboard();
  showScreen(leaderboardScreen);
});

restartBtn.addEventListener("click", () => {
  registrationForm.reset();
  showScreen(registrationScreen);
});

window.addEventListener("online", () => {
  void flushSpreadsheetQueue();
});

void flushSpreadsheetQueue();
