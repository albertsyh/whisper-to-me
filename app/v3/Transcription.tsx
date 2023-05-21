'use client';

import useAudioStore from '@/store/audio';

export default function Transcription() {
  const { streamingTranscription, fullTranscription, transcribingActive } =
    useAudioStore((store) => ({
      streamingTranscription: store.streamingTranscriptions.join(''),
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
    </div>
  );
}
