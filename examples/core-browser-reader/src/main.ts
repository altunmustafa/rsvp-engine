import { RSVPEngine } from "@rsvp-engine/core";

import "./styles.css";

const placeholderItem = { value: "Ready", ovpIndex: 2 };

const domElements = {
  textInput: document.querySelector<HTMLTextAreaElement>("#source-text")!,
  wpmInput: document.querySelector<HTMLInputElement>("#wpm")!,
  wordBefore: document.querySelector<HTMLSpanElement>("#word-before")!,
  wordOvp: document.querySelector<HTMLSpanElement>("#word-ovp")!,
  wordAfter: document.querySelector<HTMLSpanElement>("#word-after")!,
  progress: document.querySelector<HTMLProgressElement>("#progress")!,
  progressText: document.querySelector<HTMLOutputElement>("#progress-text")!,
  status: document.querySelector<HTMLParagraphElement>("#status")!,
};

const engine = new RSVPEngine({
  data: domElements.textInput.value,
  wpm: domElements.wpmInput.valueAsNumber,
});

function showWord(item: { value: string; ovpIndex: number }): void {
  domElements.wordBefore.textContent = item.value.slice(0, item.ovpIndex);
  domElements.wordOvp.textContent = item.value.slice(item.ovpIndex, item.ovpIndex + 1);
  domElements.wordAfter.textContent = item.value.slice(item.ovpIndex + 1);
}

function showProgress(value: number): void {
  const percentage = `${Math.round(value * 100)}%`;
  domElements.progress.value = value;
  domElements.progress.textContent = percentage;
  domElements.progressText.value = percentage;
}

const unsubscribe = [
  engine.on("itemChange", ({ item, progress }) => {
    showWord(item);
    showProgress(progress);
  }),
  engine.on("stateChange", ({ current }) => {
    domElements.status.textContent = `State: ${current}`;
  }),
  engine.on("complete", ({ totalItems }) => {
    domElements.status.textContent = `Complete: ${totalItems} words`;
  }),
  engine.on("error", ({ error }) => {
    domElements.status.textContent = `Error: ${error.message}`;
  }),
];

document.querySelector<HTMLButtonElement>("#load")!.addEventListener("click", () => {
  if (engine.state === "PLAYING") {
    engine.pause();
  }

  engine.load(domElements.textInput.value);
  showWord(placeholderItem);
  showProgress(0);
  domElements.status.textContent = "State: IDLE";
});

domElements.wpmInput.addEventListener("input", () => {
  if (domElements.wpmInput.reportValidity()) {
    engine.setSpeed(domElements.wpmInput.valueAsNumber);
  }
});

document.querySelector<HTMLButtonElement>("#play")!.addEventListener("click", () => engine.play());
document
  .querySelector<HTMLButtonElement>("#pause")!
  .addEventListener("click", () => engine.pause());
document.querySelector<HTMLButtonElement>("#stop")!.addEventListener("click", () => {
  engine.stop();
  showWord(placeholderItem);
  showProgress(0);
});

window.addEventListener("beforeunload", () => {
  for (const removeListener of unsubscribe) {
    removeListener();
  }
  engine.destroy();
});
