import { PencilIcon } from '@heroicons/react/24/solid';
import { memo } from 'react';
import { RECORD_STATE } from '@/store/record';

type HeaderBlockProps = {
  state: RECORD_STATE;
  hasTranscription: boolean;
  isTranscribing: boolean;
};
function HeaderBlock({
  state,
  hasTranscription,
  isTranscribing,
}: HeaderBlockProps) {
  if (isTranscribing) {
    return <h2 className="text-2xl py-10">Transcribing...</h2>;
  }
  return (
    <div>
      {(!state ||
        (['READY', 'STOPPED'].includes(state) && !hasTranscription)) && (
        <h2 className="text-2xl py-10">
          {`Hi Cath, let's start `}
          <span className="font-bold mr-3">writing</span>
          <PencilIcon className="h-5 inline" />
        </h2>
      )}
      {state === 'READY' && hasTranscription && (
        <h2 className="text-2xl py-10">
          <span className="mr-3">Start writing something new</span>
          <PencilIcon className="h-5 inline" />
        </h2>
      )}
      {state === 'RECORDING' && (
        <h2 className="text-2xl py-10">Listening...</h2>
      )}
      {state && ['PAUSED', 'STOPPED'].includes(state) && (
        <h2 className="text-2xl py-10">History</h2>
      )}
    </div>
  );
}

export default memo(HeaderBlock);
