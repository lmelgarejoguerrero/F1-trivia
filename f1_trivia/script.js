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
  {
    question: "¿A cuánto ascendió el límite presupuestario por escudería en 2026 y cuánto aumentó respecto al tope de 2023?",
    options: [
      "USD 100 millones, con un aumento de USD 20 millones",
      "USD 215 millones, con un aumento de USD 80 millones",
      "USD 500 millones, con un aumento de USD 200 millones",
    ],
    answerIndex: 1,
  },
];

questions.pop();

const REQUIRED_SCORE = 3;

let currentQuestionIndex = 0;
let score = 0;
let userData = {};
let isAnswerLocked = false;
let questionCarGoesDown = true;

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

function showScreen(screen) {
  [registrationScreen, preRaceScreen, quizScreen, resultsScreen, leaderboardScreen].forEach((s) =>
    s.classList.add("hidden")
  );
  screen.classList.remove("hidden");
}

function loadLeaderboard() {
  const data = JSON.parse(localStorage.getItem("f1LeaderBoardV2") || "[]");
  return data.sort((a, b) => {
    const bTotal = b.total || 5;
    const aTotal = a.total || 5;
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

  board.forEach((entry, index) => {
    const li = document.createElement("li");
    li.textContent = `${index + 1}. ${entry.name} — ${entry.score}/${questions.length}`;
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
  miniScore.textContent = `${score}/${REQUIRED_SCORE} para VR`;
}

function displayQuestion() {
  const q = questions[currentQuestionIndex];
  isAnswerLocked = false;
  questionTitle.textContent = q.question;
  optionsList.innerHTML = "";
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

      document.querySelectorAll(".options-list button").forEach((b) => {
        b.classList.add("locked");
      });
      btn.classList.add("selected");
      miniScore.textContent = `${score}/${REQUIRED_SCORE} para VR`;

      questionContainer.classList.add("is-exiting");
      await delay(420);

      currentQuestionIndex += 1;
      if (currentQuestionIndex < questions.length) {
        questionContainer.classList.remove("is-exiting");
        displayQuestion();
      } else {
        questionContainer.classList.remove("is-exiting");
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
  displayQuestion();
}

function showResults() {
  const qualified = score >= REQUIRED_SCORE;

  showScreen(resultsScreen);
  scoreText.textContent = `${userData.name}, terminaste con ${score} de ${questions.length} correctas.`;
  rewardText.classList.toggle("qualified", qualified);
  rewardText.textContent = qualified
    ? "Clasificaste: podés subirte al simulador de Fórmula 1 con realidad virtual."
    : `Te faltó poco: necesitabas ${REQUIRED_SCORE} correctas para desbloquear el simulador VR.`;
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
    name: `${fname} ${lname}`,
    email,
    phone,
  };

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
