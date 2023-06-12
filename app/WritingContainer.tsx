'use client';

import {
  getTranscriptionForGroup,
  storeIsReadyForNew,
  useTranscribeStore,
} from '@/store/transcribe';
import { startVersion, useWritingStore } from '@/store/write';
import { useEffect, useState } from 'react';
import { shallow } from 'zustand/shallow';

export function WritingContainer() {
  const [lastProcessedTranscriptionGroup, setLastProcessedTranscriptionGroup] =
    useState<number>(-1); // Don't actually use this value, other than the incremented version because of the -1

  const noVersionsYet = useWritingStore((state) => state.versions.length === 0);

  const goodToGoWithLastVersion = useWritingStore((state) => {
    if (!state.versions.length) return true;

    return !!state.versions[state.versions.length - 1].completedAt;
  });

  const nextTranscriptionToProcess = useTranscribeStore((state) => {
    const nextTranscription = getTranscriptionForGroup(
      state,
      lastProcessedTranscriptionGroup + 1
    );

    if (
      nextTranscription.fullTranscription &&
      !nextTranscription.active &&
      !nextTranscription.pendingJobs &&
      (nextTranscription.groupId - state.currentTranscriptionGroup > 1 ||
        storeIsReadyForNew(state))
    )
      return nextTranscription;

    return null;
  });

  // TODO: this component should be considered deeply when rehydrating persisted state, fyi.

  useEffect(() => {
    if (
      nextTranscriptionToProcess &&
      nextTranscriptionToProcess.groupId > lastProcessedTranscriptionGroup
    ) {
      console.log(
        'Transcription remaining to process - ',
        nextTranscriptionToProcess
      );

      startVersion(nextTranscriptionToProcess.fullTranscription!);

      async (versionId: number) => {};

      setLastProcessedTranscriptionGroup(nextTranscriptionToProcess.groupId);
    }
  }, [nextTranscriptionToProcess, lastProcessedTranscriptionGroup]);

  const { versionIds } = useWritingStore(
    (state) => ({
      versionIds: state.versions.map((version) => version.startedAt),
    }),
    shallow
  );

  return (
    <div className="h-full flex flex-row">
      <h1 className="text-lg font-bold flex justify-between items-center h-11">
        <span className="uppercase">Writer</span>
      </h1>
    </div>
  );
}
