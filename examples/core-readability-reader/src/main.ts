import { RSVPEngine } from "@rsvp-engine/core";

import { extractReadableArticle, fetchHtmlSource } from "./extract";
import "./styles.css";

const placeholderItem = { value: "Ready", ovpIndex: 2 };

const domElements = {
  extractedText: document.querySelector<HTMLTextAreaElement>("#extracted-text")!,
  fetchButton: document.querySelector<HTMLButtonElement>("#fetch-source")!,
  fetchForm: document.querySelector<HTMLFormElement>("#fetch-form")!,
  metadata: document.querySelector<HTMLOutputElement>("#metadata")!,
  pauseButton: document.querySelector<HTMLButtonElement>("#pause")!,
  parseButton: document.querySelector<HTMLButtonElement>("#parse-source")!,
  parseForm: document.querySelector<HTMLFormElement>("#parse-form")!,
  playButton: document.querySelector<HTMLButtonElement>("#play")!,
  progress: document.querySelector<HTMLProgressElement>("#progress")!,
  progressText: document.querySelector<HTMLOutputElement>("#progress-text")!,
  status: document.querySelector<HTMLParagraphElement>("#status")!,
  stopButton: document.querySelector<HTMLButtonElement>("#stop")!,
  sourceHtml: document.querySelector<HTMLTextAreaElement>("#source-html")!,
  wordAfter: document.querySelector<HTMLSpanElement>("#word-after")!,
  wordBefore: document.querySelector<HTMLSpanElement>("#word-before")!,
  wordOvp: document.querySelector<HTMLSpanElement>("#word-ovp")!,
  wpmInput: document.querySelector<HTMLInputElement>("#wpm")!,
  urlInput: document.querySelector<HTMLInputElement>("#source-url")!,
};

let fetchController: AbortController | undefined;

const engine = new RSVPEngine({
  data: domElements.extractedText.value,
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

function setPlaybackDisabled(disabled: boolean): void {
  domElements.playButton.disabled = disabled;
  domElements.pauseButton.disabled = disabled;
  domElements.stopButton.disabled = disabled;
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

async function fetchSource(event: SubmitEvent): Promise<void> {
  event.preventDefault();

  const sourceUrl = domElements.urlInput.value.trim();

  if (!sourceUrl) {
    domElements.status.textContent = "Enter a URL before fetching page source.";
    domElements.urlInput.focus();
    return;
  }

  fetchController?.abort();
  const controller = new AbortController();
  fetchController = controller;
  domElements.fetchButton.disabled = true;
  domElements.parseButton.disabled = true;
  domElements.status.textContent = "Fetching page source…";

  try {
    const source = await fetchHtmlSource(new URL(sourceUrl), controller.signal);
    domElements.sourceHtml.value = source;
    domElements.status.textContent = `Fetched ${source.length} characters. You can edit the source before parsing.`;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }

    const message = error instanceof Error ? error.message : "Unknown fetch error";
    domElements.status.textContent = `Could not fetch page source: ${message}`;
  } finally {
    if (fetchController === controller) {
      fetchController = undefined;
      domElements.fetchButton.disabled = false;
      domElements.parseButton.disabled = false;
    }
  }
}

function parseAndLoadSource(event: SubmitEvent): void {
  event.preventDefault();

  try {
    if (engine.state === "PLAYING") {
      engine.pause();
    }

    const article = extractReadableArticle(domElements.sourceHtml.value);

    if (!article) {
      domElements.status.textContent = "No readable article was found in the page source.";
      return;
    }

    engine.load(article.text);
    domElements.extractedText.value = article.text;
    domElements.metadata.value = [article.title, article.byline, article.lang]
      .filter((value) => value)
      .join(" · ");
    showWord(placeholderItem);
    showProgress(0);
    setPlaybackDisabled(false);
    domElements.status.textContent = `Loaded ${article.text.length} characters.`;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown extraction error";
    domElements.status.textContent = `Could not parse page source: ${message}`;
  }
}

domElements.fetchForm.addEventListener("submit", (event) => {
  void fetchSource(event);
});

domElements.parseForm.addEventListener("submit", (event) => {
  parseAndLoadSource(event);
});

domElements.wpmInput.addEventListener("input", () => {
  if (domElements.wpmInput.reportValidity()) {
    engine.setSpeed(domElements.wpmInput.valueAsNumber);
  }
});

domElements.playButton.addEventListener("click", () => engine.play());
domElements.pauseButton.addEventListener("click", () => engine.pause());
domElements.stopButton.addEventListener("click", () => {
  engine.stop();
  showWord(placeholderItem);
  showProgress(0);
});

window.addEventListener("beforeunload", () => {
  fetchController?.abort();
  for (const removeListener of unsubscribe) {
    removeListener();
  }
  engine.destroy();
});
