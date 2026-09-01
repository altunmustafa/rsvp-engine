import { parseArgs } from "node:util";

import { RSVPEngine } from "@rsvp-engine/core";

const defaultText =
  "Rapid serial visual presentation (RSVP) is a scientific method for studying the timing of vision. In RSVP, a sequence of stimuli is shown to an observer at one location in their visual field. The observer is instructed to report one of these stimuli – the target – which has a feature that differentiates it from the rest of the stream. For instance, observers may see a sequence of stimuli consisting of gray letters with the exception of one red letter. They are told to report the red letter. People make errors in this task in the form of reports of stimuli that occurred before or after the target. The position in time of the letter they report, relative to the target, is an estimate of the timing of visual selection on that trial.";
const { values } = parseArgs({
  options: {
    text: { type: "string" },
    wpm: { type: "string" },
  },
});
const text = values.text ?? defaultText;
const wpm = values.wpm !== undefined ? Number(values.wpm) : 300;

const engine = new RSVPEngine({ data: text, wpm });

function highlightOvp(value: string, ovpIndex: number): string {
  const before = value.slice(0, ovpIndex);
  const ovp = value.slice(ovpIndex, ovpIndex + 1);
  const after = value.slice(ovpIndex + 1);
  const focusColumn = Math.floor((process.stdout.columns ?? 80) / 2);
  const padding = " ".repeat(Math.max(0, focusColumn - ovpIndex));

  return `${padding}${before}\u001b[90m${ovp}\u001b[39m${after}`;
}

engine.on("itemChange", ({ item }) => {
  process.stdout.write(`\r\u001b[2K${highlightOvp(item.value, item.ovpIndex)}`);
});

engine.on("complete", ({ totalItems }) => {
  process.stdout.write(`\nComplete: ${totalItems} words\n`);
  engine.destroy();
});

engine.on("error", ({ error }) => {
  process.stderr.write(`\nError: ${error.message}\n`);
  process.exitCode = 1;
});

process.once("SIGINT", () => {
  engine.destroy();
  process.stdout.write("\nStopped\n");
  process.exitCode = 130;
});

engine.play();
