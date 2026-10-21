import {
  RsvpEngine,
  type RsvpEventType,
  type RsvpSnapshot,
  TextTokenizer,
} from "@rsvp-engine/core";

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

const engine = new RsvpEngine({
  tokenizer: new TextTokenizer(),
  wpm: domElements.wpmInput.valueAsNumber,
  onError: showError,
});
engine.load(domElements.textInput.value);

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

function renderPlayback(snapshot: RsvpSnapshot<string>, eventType: RsvpEventType): void {
  if (eventType === "started" || eventType === "advanced" || eventType === "navigated") {
    if (snapshot.currentItem) {
      showWord(snapshot.currentItem);
    }
  } else if (eventType === "loaded" || eventType === "stopped" || eventType === "reset") {
    showWord(placeholderItem);
  }
  showProgress(snapshot.progress);
  domElements.status.textContent =
    snapshot.state === "COMPLETED"
      ? `Complete: ${snapshot.totalItems} words`
      : `State: ${snapshot.state}`;
}

function showError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  domElements.status.textContent = `Error: ${message}`;
}

function runCommand(command: () => void): void {
  try {
    command();
  } catch (error) {
    showError(error);
  }
}

const unsubscribe = engine.subscribe(renderPlayback);

document.querySelector<HTMLButtonElement>("#load")!.addEventListener("click", () => {
  runCommand(() => {
    if (engine.state === "PLAYING") {
      engine.pause();
    } else if (engine.state === "ERROR") {
      engine.reset();
    }
    engine.load(domElements.textInput.value);
  });
});

domElements.wpmInput.addEventListener("input", () => {
  if (domElements.wpmInput.reportValidity()) {
    runCommand(() => engine.setWpm(domElements.wpmInput.valueAsNumber));
  }
});

document.querySelector<HTMLButtonElement>("#play")!.addEventListener("click", () => {
  runCommand(() => engine.play());
});
document.querySelector<HTMLButtonElement>("#pause")!.addEventListener("click", () => {
  runCommand(() => engine.pause());
});
document.querySelector<HTMLButtonElement>("#stop")!.addEventListener("click", () => {
  runCommand(() => engine.stop());
});

window.addEventListener("beforeunload", () => {
  unsubscribe();
  engine.destroy();
});
