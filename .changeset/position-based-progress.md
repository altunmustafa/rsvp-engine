---
"@rsvp-engine/core": major
"@rsvp-engine/react": major
---

Derive progress from playback position instead of counting the selected item. Initial playback has progress zero; seek and navigation use `currentIndex / totalItems`; progress reaches one only after the final display period ends. Empty input has progress zero. Fatal playback or navigation failures preserve the last published progress; fatal loading failures clear it to zero. Update progress displays and assertions that counted the selected item before it finished. Core and React README migration sections describe the new behavior.
