const QUESTIONS = [
  {
    question: "Which component converts the piston’s reciprocating movement into rotation?",
    answers: ["Camshaft", "Crankshaft", "Spark plug", "Intake valve"],
    correct: 1,
    explanation: "The crankshaft converts the connecting rod’s push-pull motion into rotation."
  },
  {
    question: "How far does the crankshaft rotate during one four-stroke cycle?",
    answers: ["180°", "360°", "540°", "720°"],
    correct: 3,
    explanation: "Intake, compression, power and exhaust span two crankshaft revolutions (720°)."
  },
  {
    question: "In a four-stroke engine, how fast does the camshaft rotate compared with the crankshaft?",
    answers: ["At the same speed", "Twice as fast", "Half speed", "One quarter speed"],
    correct: 2,
    explanation: "The camshaft completes one revolution for every two crankshaft revolutions."
  }
];

export function setupQuiz(root) {
  if (!root || root.dataset.ready === "true") return;
  root.dataset.ready = "true";

  let index = 0;
  let score = 0;
  let answered = false;
  let complete = false;

  const byId = (id) => root.querySelector("#" + id);
  const prompt = byId("quizPrompt");
  const options = byId("quizOptions");
  const feedback = byId("quizFeedback");
  const progress = byId("quizProgress");
  const scoreLabel = byId("quizScore");
  const next = byId("quizNext");

  function renderQuestion() {
    complete = false;
    answered = false;
    const item = QUESTIONS[index];
    progress.textContent = "QUESTION " + (index + 1) + " / " + QUESTIONS.length;
    prompt.textContent = item.question;
    options.replaceChildren();

    item.answers.forEach((answer, choiceIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quizOption";
      button.dataset.option = String(choiceIndex);
      const letter = document.createElement("span");
      letter.textContent = String.fromCharCode(65 + choiceIndex);
      button.append(letter, document.createTextNode(answer));
      options.append(button);
    });

    feedback.textContent = "";
    feedback.className = "quizFeedback";
    scoreLabel.textContent = "Score: " + score;
    next.disabled = true;
    next.textContent = index === QUESTIONS.length - 1 ? "See results →" : "Next question →";
  }

  function finish() {
    complete = true;
    progress.textContent = "QUIZ COMPLETE";
    prompt.textContent = "You finished the Engine IQ check.";
    options.replaceChildren();
    feedback.className = "quizFeedback good";
    feedback.textContent = "Your score: " + score + " / " + QUESTIONS.length + ". " +
      (score === QUESTIONS.length ? "Perfect run — excellent engine knowledge." :
        score >= 2 ? "Nice work. Review the explanations and try for a perfect score." :
        "Keep exploring the engine lab, then give it another go.");
    scoreLabel.textContent = "Final score: " + score + " / " + QUESTIONS.length;
    next.disabled = false;
    next.textContent = "Try again ↻";
  }

  root.addEventListener("click", (event) => {
    const option = event.target.closest("[data-option]");
    if (option && root.contains(option) && !answered && !complete) {
      answered = true;
      const item = QUESTIONS[index];
      const choice = Number(option.dataset.option);
      const correct = choice === item.correct;
      if (correct) score += 1;

      [...options.querySelectorAll(".quizOption")].forEach((button) => {
        button.disabled = true;
        const answerIndex = Number(button.dataset.option);
        if (answerIndex === item.correct) button.classList.add("correct");
        else if (answerIndex === choice) button.classList.add("incorrect");
      });

      feedback.className = "quizFeedback " + (correct ? "good" : "bad");
      feedback.textContent = (correct ? "Correct! " : "Not quite. ") + item.explanation;
      scoreLabel.textContent = "Score: " + score;
      next.disabled = false;
      return;
    }

    if (event.target.closest("#quizNext")) {
      if (next.disabled) return;
      if (complete) {
        index = 0;
        score = 0;
        renderQuestion();
      } else if (index === QUESTIONS.length - 1) {
        finish();
      } else {
        index += 1;
        renderQuestion();
      }
    }
  });

  renderQuestion();
}
