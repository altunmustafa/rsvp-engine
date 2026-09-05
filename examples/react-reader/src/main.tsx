import { createRsvpContext, createRsvpController } from "@rsvp-engine/react";
import { useState } from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";

const initialText =
  "Speed reading reduces eye movement by displaying words sequentially at a fixed focal point.";

const controller = createRsvpController({ data: initialText, wpm: 300 });
const { RsvpProvider, useRsvpActions, useRsvpSelector } = createRsvpContext<string>();

function WordDisplay() {
  const currentItem = useRsvpSelector(({ snapshot }) => snapshot.currentItem);
  const value = currentItem?.value ?? "Ready";
  const ovpIndex = currentItem?.ovpIndex ?? 2;

  return (
    <div className="word" aria-label={`Displayed word: ${value}`}>
      <span className="word-before">{value.slice(0, ovpIndex)}</span>
      <span className="word-ovp">{value.slice(ovpIndex, ovpIndex + 1)}</span>
      <span className="word-after">{value.slice(ovpIndex + 1)}</span>
    </div>
  );
}

function Progress() {
  const progress = useRsvpSelector(({ snapshot }) => snapshot.progress);
  const percentage = Math.round(progress * 100);

  return (
    <div className="progress-row">
      <label htmlFor="reader-progress">Progress</label>
      <progress id="reader-progress" value={progress} max={1}>
        {percentage}%
      </progress>
      <output htmlFor="reader-progress">{percentage}%</output>
    </div>
  );
}

function PlaybackControls() {
  const state = useRsvpSelector(({ snapshot }) => snapshot.state);
  const totalItems = useRsvpSelector(({ snapshot }) => snapshot.totalItems);
  const { pause, play, stop } = useRsvpActions();

  return (
    <div className="controls" aria-label="Playback controls">
      <button type="button" onClick={play} disabled={state === "PLAYING" || totalItems === 0}>
        Start
      </button>
      <button type="button" onClick={pause} disabled={state !== "PLAYING"}>
        Pause
      </button>
      <button type="button" onClick={stop} disabled={state !== "PLAYING" && state !== "PAUSED"}>
        Stop
      </button>
    </div>
  );
}

function ReaderSettings() {
  const [source, setSource] = useState(initialText);
  const state = useRsvpSelector(({ snapshot }) => snapshot.state);
  const wpm = useRsvpSelector(({ snapshot }) => snapshot.wpm);
  const { load, pause, reset, setSpeed } = useRsvpActions();

  function loadSource(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (state === "PLAYING") {
      pause();
    } else if (state === "ERROR") {
      reset();
    }

    load(source);
  }

  return (
    <form className="settings" action="" onSubmit={loadSource}>
      <div className="field">
        <label htmlFor="source-text">Text to read</label>
        <textarea
          id="source-text"
          name="sourceText"
          value={source}
          onChange={(event) => setSource(event.currentTarget.value)}
          rows={5}
          required
        />
      </div>

      <div className="speed-field">
        <label htmlFor="reader-wpm">Speed: {wpm} WPM</label>
        <input
          id="reader-wpm"
          name="wpm"
          type="range"
          min={100}
          max={1_000}
          step={25}
          value={wpm}
          onChange={(event) => setSpeed(event.currentTarget.valueAsNumber)}
        />
      </div>

      <button type="submit">Load text</button>
    </form>
  );
}

function Status() {
  const state = useRsvpSelector(({ snapshot }) => snapshot.state);
  const error = useRsvpSelector(({ error }) => error);

  return (
    <p className={error === null ? "status" : "status error"} aria-live="polite">
      {error === null ? `Status: ${state}` : `Error: ${error.message}`}
    </p>
  );
}

function App() {
  return (
    <RsvpProvider controller={controller}>
      <main>
        <header>
          <p className="eyebrow">@rsvp-engine/react</p>
          <h1>React RSVP reader</h1>
          <p>Context selectors subscribe only to the state fields they need.</p>
        </header>

        <ReaderSettings />

        <section className="reader" aria-labelledby="reader-heading">
          <h2 id="reader-heading">Reader</h2>
          <WordDisplay />
          <Progress />
          <PlaybackControls />
          <Status />
        </section>
      </main>
    </RsvpProvider>
  );
}

const rootElement = document.querySelector<HTMLDivElement>("#root");
if (rootElement === null) {
  throw new Error("React root element is missing.");
}

const root = createRoot(rootElement);
root.render(<App />);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    root.unmount();
    controller.destroy();
  });
}
