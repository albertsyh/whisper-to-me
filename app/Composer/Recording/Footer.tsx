import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import {
  ChatBubbleOvalLeftEllipsisIcon,
  CheckIcon,
  MicrophoneIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  StopCircleIcon,
} from '@heroicons/react/24/solid';

import Button from '@/components/Button';
import {
  RecordingStore,
  Transcription,
  updateRecordingState,
  updateTranscribingState,
  useRecordingStore,
} from '@/store/record';

type RecordingFooterProps = {
  timeElapsedStr: string | null;
  setTimeElapsedStr: Dispatch<SetStateAction<string | null>>;
  startAudio: (isInit?: boolean) => Promise<MediaStream>;
  stopAudio: (stream?: MediaStream, isInit?: boolean) => void;
  stopRecording: () => Promise<void>;
  startRecording: () => Promise<void>;
  onStartGpt: (transcription: Transcription) => void;
};
function RecordingFooter({
  timeElapsedStr,
  setTimeElapsedStr,
  startAudio,
  stopAudio,
  stopRecording,
  startRecording,
  onStartGpt,
}: RecordingFooterProps) {
  const { recordingState, isTranscribing, transcriptions } = useRecordingStore(
    ({ recordingState, isTranscribing, transcriptions }) => ({
      recordingState,
      isTranscribing,
      transcriptions,
    })
  );

  // Stopping when user is recording
  const handleStop = useCallback(async () => {
    await stopRecording();
    stopAudio();
  }, [stopAudio, stopRecording]);

  // Stopping when user is paused (complete)
  const handleFinish = useCallback(() => {
    onStartGpt(transcriptions[transcriptions.length - 1]);
    setTimeElapsedStr('');
  }, [transcriptions, onStartGpt, setTimeElapsedStr]);

  const handleState = useCallback(async () => {
    if (!recordingState) {
      // Initialisation when mic permissions has not been granted
      const audioStream = await startAudio();
      stopAudio(audioStream, true);
    } else if (['READY', 'STOPPED'].includes(recordingState)) {
      await startAudio(true);
      startRecording();
      updateRecordingState('RECORDING');
    } else if (recordingState === 'RECORDING') {
      stopRecording();
      updateRecordingState('PAUSED');
      updateTranscribingState(true);
    } else if (recordingState === 'PAUSED') {
      startRecording();
      updateRecordingState('RECORDING');
    }
  }, [recordingState, startAudio, startRecording, stopAudio, stopRecording]);

  const ButtonIcon = useMemo(() => {
    if (isTranscribing) return ChatBubbleOvalLeftEllipsisIcon;
    if (!recordingState || ['STOPPED', 'READY'].includes(recordingState))
      return MicrophoneIcon;
    if (recordingState === 'RECORDING') return PauseCircleIcon;
    return PlayCircleIcon;
  }, [recordingState, isTranscribing]);

  // Run gpt processing when stopped
  useEffect(() => {
    const unsub = useRecordingStore.subscribe(
      (state) => ({
        recordingState: state.recordingState,
        transcriptions: state.transcriptions,
      }),
      (
        state: Pick<RecordingStore, 'recordingState' | 'transcriptions'>,
        prevState: Pick<RecordingStore, 'recordingState' | 'transcriptions'>
      ) => {
        if (
          state.recordingState === 'STOPPED' &&
          prevState.recordingState === 'RECORDING'
        ) {
          // Process GPT
          onStartGpt(state.transcriptions[state.transcriptions.length - 1]);
          setTimeElapsedStr('');
        }
      }
    );
    return () => {
      unsub();
    };
  }, []); // eslint-disable-line

  return (
    <div className="fixed md:relative bottom-0 right-0 p-4 w-full flex">
      <div className="flex gap-2 ml-auto">
        {recordingState && recordingState === 'RECORDING' && (
          <Button variant="danger" onClick={handleStop}>
            Stop <StopCircleIcon className="h-5 inline" />
          </Button>
        )}
        {recordingState && recordingState === 'PAUSED' && (
          <Button variant="success" onClick={handleFinish}>
            Finish <CheckIcon className="h-5 inline" />
          </Button>
        )}
        <Button onClick={handleState} disabled={isTranscribing}>
          {timeElapsedStr && <span className="mr-2">{timeElapsedStr}</span>}
          <ButtonIcon className="h-5 inline" />
        </Button>
      </div>
    </div>
  );
}

export default RecordingFooter;
