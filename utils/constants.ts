// How long are we allowing the previous chunk of transcript to be, that is
// fed into Whisper? Docs (https://platform.openai.com/docs/guides/speech-to-text/prompting)
// suggest they only use the last 224 tokens, so we'll keep it to 400 chars.
export const MAX_PREVIOUS_TRANSCRIPT_LENGTH = 400;
export const TRANSCRIBE_TIME_SLICES = 5;
