'use client';

import useAudioStore from '@/store/audio';
import { TRANSCRIBE_TIME_SLICES } from '@/utils/constants';

export default function Transcription() {
  const {
    streamingTranscription,
    fullTranscription,
    trailingTranscription,
    previousTrailingTranscription,
    transcribingActive,
  } = useAudioStore((store) => ({
    streamingTranscription: store.streamingTranscriptions.join(''),
    previousTrailingTranscription:
      store.trailingTranscriptions.length > TRANSCRIBE_TIME_SLICES
        ? store.trailingTranscriptions[
            store.trailingTranscriptions.length - TRANSCRIBE_TIME_SLICES
          ]
        : '',
    trailingTranscription: store.trailingTranscriptions.length
      ? store.trailingTranscriptions[store.trailingTranscriptions.length - 1]
      : '',
    fullTranscription: store.fullTranscription,
    transcribingActive: store.transcribingFull || store.transcribingStream,
  }));

  return (
    <div>
      <div className="text-xl font-bold">
        Transcription {transcribingActive ? '(Processing)' : ''}
      </div>
      {!fullTranscription ? (
        <div className="text-large">Streaming: {streamingTranscription}</div>
      ) : (
        <div className="text-large">Full: {fullTranscription}</div>
      )}
      <div className="mt-5 text-large text-orange-400">
        {' '}
        Trailing: {previousTrailingTranscription} + {trailingTranscription}
      </div>
    </div>
  );
}
