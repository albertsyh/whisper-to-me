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
      <div className="flex flex-row justify-items-center gap-5">
        <div className="text-large w-3/12">
          {!fullTranscription
            ? 'Streaming:' +
              ('...' + streamingTranscription.slice(-400).slice(0, -10) + '...')
            : 'Full: ' + fullTranscription}
        </div>
        <div className="text-large text-emerald-900 w-3/12">
          {' '}
          Trailing:{' '}
          {'...' +
            (previousTrailingTranscription + ' ' + trailingTranscription)
              .slice(-400)
              .slice(0, -10) +
            '...'}
        </div>
      </div>
    </div>
  );
}
