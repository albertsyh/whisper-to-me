'use client';

import {
  getTranscriptionForGroup,
  storeIsReadyForNew,
  useTranscribeStore,
} from '@/store/transcribe';
import { startVersion, useWritingStore } from '@/store/write';
import { useEffect, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { WritingVersion } from './WritingVersion';

const DEFAULT_VERSION_GROUP = 1; // Just hardcoding for now, we can do more when we do multiple groups

export function WritingContainer() {
  const [lastProcessedTranscriptionGroup, setLastProcessedTranscriptionGroup] =
    useState<number>(-1); // Don't actually use this value, other than the incremented version because of the -1

  const { nextTranscriptionGroup, nextFullTranscript } = useTranscribeStore(
    (state) => {
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
        return {
          nextTranscriptionGroup: nextTranscription.groupId,
          nextFullTranscript: nextTranscription.fullTranscription,
        };

      return {
        nextTranscriptionGroup: null,
        nextFullTranscript: null,
      };
    }
  );

  // const nextTranscriptionToProcess = useTranscribeStore((state) => {
  //   const nextTranscription = getTranscriptionForGroup(
  //     state,
  //     lastProcessedTranscriptionGroup + 1
  //   );

  //   if (
  //     nextTranscription.fullTranscription &&
  //     !nextTranscription.active &&
  //     !nextTranscription.pendingJobs &&
  //     (nextTranscription.groupId - state.currentTranscriptionGroup > 1 ||
  //       storeIsReadyForNew(state))
  //   )
  //     return nextTranscription;

  //   return null;
  // });

  // TODO: this component should be considered deeply when rehydrating persisted state, fyi.

  useEffect(() => {
    console.log(
      'useEffect, nextTranscriptionGroup - ',
      nextTranscriptionGroup,
      ', nextFullTranscript - ',
      nextFullTranscript,
      ', lastProcessedTranscriptionGroup - ',
      lastProcessedTranscriptionGroup
    );

    if (
      nextTranscriptionGroup !== null &&
      nextFullTranscript !== null &&
      nextTranscriptionGroup > lastProcessedTranscriptionGroup
    ) {
      console.log('Setting last processed to ', nextTranscriptionGroup);
      setLastProcessedTranscriptionGroup(nextTranscriptionGroup);

      startVersion(nextFullTranscript, DEFAULT_VERSION_GROUP);
    }
  }, [nextTranscriptionGroup, lastProcessedTranscriptionGroup]);

  // useEffect(() => {
  //   console.log(
  //     'useEffect, nextTranscriptionToProcess - ',
  //     nextTranscriptionToProcess,
  //     ', lastProcessedTranscriptionGroup - ',
  //     lastProcessedTranscriptionGroup
  //   );

  //   if (
  //     nextTranscriptionToProcess &&
  //     nextTranscriptionToProcess.groupId > lastProcessedTranscriptionGroup
  //   ) {
  //     console.log(
  //       'Transcription remaining to process - ',
  //       nextTranscriptionToProcess
  //     );

  //     console.log(
  //       'Setting last processed to ',
  //       nextTranscriptionToProcess.groupId
  //     );
  //     setLastProcessedTranscriptionGroup(nextTranscriptionToProcess.groupId);

  //     startVersion(
  //       nextTranscriptionToProcess.fullTranscription!,
  //       DEFAULT_VERSION_GROUP
  //     );
  //   }
  // }, [nextTranscriptionToProcess, lastProcessedTranscriptionGroup]);

  const versionIds = useWritingStore(
    (state) => state.versions.map((version) => version.startedAt),
    shallow
  );

  return (
    <div className="h-full flex flex-row">
      <h1 className="text-lg font-bold flex justify-between items-center h-11">
        <span className="uppercase">Writer</span>
      </h1>
      <div className="flex flex-row">
        {versionIds.map((versionId) => (
          <WritingVersion key={versionId} versionId={versionId} />
        ))}
      </div>
    </div>
  );
}
