import { generateShortUUID } from '@/utils/random';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ####################### READ ME FIRST #######################

/**
 * The basic point of this store is to simplify the massively async
 * nature of transcriptions. The useWhisper hook can fire off transcribe
 * jobs at any time, we want to try and keep transcribe on silence since
 * it lowers the latency at final transcription (we're not fully using
 * it yet), since we end transcriptions on pause, we now have jobs that
 * need to be batched together, and we also want to make sure that all
 * pending transcription jobs (which can come back in different orders
 * and fail/succeed independently) are all referred and joined together correctly.
 *
 * We also want a store that most useful states (what is the current
 * transcription? How much time has elapsed? What is the latest streamed
 * transcription? etc) can be inferred from the state. I've made the best
 * effort to rein in this complexity into selectors already in this store
 * that can be made use of, and tested as best I can.  I've also tried to
 * make selectors and reducers as atomic and idempotent as possible (in
 * that they don't mostly need you to read from the store state, they try
 * and operate on the state directly), which should reduce re-renders.
 * One single issue remains - it's not unfixable, but it's late today :)
 */

/**
 * Here is the basic premise of operation:
 * 1. Transcriptions are the thing between the user presses start
 * until they press pause/stop.
 * 2. Multiple transcriptions can be grouped into one groupId, and
 * you're not really writing until the groupId has been completed.
 * 3. Each transcription can have multiple pending jobs - either
 * of type 'PARTIAL' or 'FULL', and we don't re-enable recording
 * until the 'FULL' job has been posted (not completed) to this
 * board. This is to make sure that some async bug doesn't cause
 * one job to be posted to another transcription and to try and
 * keep all changes atomic.
 * 4. You mostly operate the store by calling newJob when you want
 * to start a new job, and newTranscription and endTranscription when
 * you start and finish a transcription. Job management is simple -
 * you call the store when you start a job, and it gives you an id
 * you can pass back in to register your result - or non-result.
 * 5. The store state is intentionally simple - it's mostly a log of
 * transcriptions and jobs, and the state of these logs is updated when
 * they change. Should be easy to read and reason about, not to mention
 * inspect. All other state is derived inside the selectors, and zustand's
 * diffing should make sure that they don't re-render things once
 * they're done.
 * */

/**
 * Things to do better:
 * 1. There's a few deep copies using JSON.parse that I don't love.
 * They're not that bad - the state isn't that big, and we're not storing blobs.
 * I don't like them anyway.
 * 2. The selectors are sometimes a little heavy, and maybe it's worth considering
 * caching some of the output in the store, but I'm worried about doing that because
 * React, and I don't know which piece of fragmented state will end up in which
 * orphaned component that will be a headache in debugging. This is somewhat
 * (but not that much) computationally inefficient, but it makes for easier code
 * to reason about.
 */

export type TranscribeStoreState = {
  state: 'INIT' | 'NOT_LISTENING' | 'LISTENING';
  currentTranscriptionGroup: number;
  transcriptions: {
    startedTimestamp: number; // We're using this as the id for jobs. Should be fine.
    endedTimestamp?: number;
    groupId: number;
  }[];
  jobs: {
    transcriptionId: number; // Same as transcription's startedTimestamp
    pieceId: string; // This is the uuid that is used to post the job result. Shouldn't be a problem, we're filtering only in pending jobs so collision probability is near-nothing for just 8 alphanumeric characters.
    type: 'FULL' | 'PARTIAL'; // Partial means it's a transcribe on silent.
    state: 'PROCESSING' | 'TRANSCRIBED' | 'FAILED' | 'EMPTY'; // The empty state exists to say use other transcriptions instead of this one.
    startProcessing?: Date;
    endProcessing?: Date;
    transcription: string | null;
  }[];
};

export const useTranscribeStore = create<TranscribeStoreState>()(
  devtools(
    (set, get) => ({
      state: 'INIT',
      currentTranscriptionGroup: 0,
      transcriptions: [],
      jobs: [],
    }),
    { name: 'TranscribeStore', trace: true, serialize: { options: true } }
  )
);

/**
 * Reset the store. Not really used yet, but useful if we want to reset
 * things in case of failure or reload.
 */
export const resetTranscribeStore = () => {
  useTranscribeStore.setState(
    {
      state: 'NOT_LISTENING',
      transcriptions: [],
      jobs: [],
    },
    false,
    'GETTING_READY'
  );
};

/**
 * Start a new transcription group. Will make the old one completed once all
 * the pending jobs there are done.
 */
export const newGroup = () => {
  useTranscribeStore.setState(
    (state) => ({
      currentTranscriptionGroup: state.currentTranscriptionGroup + 1,
    }),
    false,
    'NEW_GROUP'
  );
};

/**
 * Simple as it sounds. Start a new transcription and set the store to listening.
 * We only want to do this when storeIsReadyForNew is true.
 */
export const newTranscription = () => {
  useTranscribeStore.setState(
    (state: TranscribeStoreState) => {
      return {
        state: 'LISTENING',
        transcriptions: [
          ...state.transcriptions,
          {
            startedTimestamp: Date.now(),
            groupId: state.currentTranscriptionGroup,
          },
        ],
      };
    },
    false,
    'NEW_TRANSCRIPTION'
  );
};

/**
 * Ends a transcription. Super simple.
 */
export const endTranscription = () => {
  useTranscribeStore.setState(
    (state: TranscribeStoreState) => {
      const newTranscriptions = JSON.parse(
        JSON.stringify(state.transcriptions)
      );

      if (!newTranscriptions[newTranscriptions.length - 1].endedTimestamp)
        newTranscriptions[newTranscriptions.length - 1].endedTimestamp =
          Date.now();

      return {
        state: 'NOT_LISTENING',
        transcriptions: newTranscriptions,
      };
    },
    false,
    'END_TRANSCRIPTION'
  );
};

/**
 * Create a new job. It presumes you mean the current active transcription.
 * @param type PARTIAL or FULL
 * @returns The uuid you can use to mark the job as completed or failed.
 */
export const newJob = (
  type: TranscribeStoreState['jobs'][0]['type'],
  empty?: boolean
) => {
  const pieceId = generateShortUUID();

  useTranscribeStore.setState(
    (state) => {
      let job: TranscribeStoreState['jobs'][0] = {
        transcriptionId: getLatestTranscription(state).startedTimestamp,
        pieceId,
        startProcessing: new Date(),
        state: 'PROCESSING',
        transcription: null,
        type,
      };

      if (empty) {
        job.state = 'EMPTY';
        job.endProcessing = new Date();
      }

      return {
        jobs: [...state.jobs, job],
      };
    },
    false,
    'STARTED_JOB'
  );

  return pieceId;
};

/**
 * Mark a job as completed or failed.
 * @param pieceId The uuid indicating which job this is. The UUID bypasses you
 * needing to know about which transcription this job is in.
 * @param transcript Do you have a transcript? I hope you do.
 */
export const completeJob = (pieceId: string, transcript?: string) => {
  useTranscribeStore.setState(
    (state) => {
      const newjobs: TranscribeStoreState['jobs'] = JSON.parse(
        JSON.stringify(state.jobs)
      ); // Doing this primarily for a deep copy
      const matchingJob = newjobs.find(
        (job) => job.pieceId === pieceId && !job.endProcessing
      );
      if (matchingJob) {
        if (transcript) {
          matchingJob.state = 'TRANSCRIBED';
          matchingJob.transcription = transcript;
        } else {
          matchingJob.state = 'FAILED';
        }

        matchingJob.endProcessing = new Date();

        return {
          jobs: newjobs,
        };
      }

      console.log('Could not find matching transcript to complete processing', {
        pieceId,
        transcript,
      });

      return {};
    },
    false,
    'COMPLETED_JOB'
  );
};

// ################## SELECTORS ###################

/**
 * Return the latest transcription. Does a little somewhat unnecessary sorting
 * to make sure.
 * @param state
 * @returns
 */
const getLatestTranscription = (state: TranscribeStoreState) => {
  return state.transcriptions.sort(
    (a, b) => a.startedTimestamp - b.startedTimestamp
  )[state.transcriptions.length - 1];
};

/**
 * This is one of the examples of a complex selector encapsulating derived
 * state. The store is ready for you to start a new transcription if its not currently listening, and the last transcription (if one exists) has its
 * full transcription job posted (no need to complete).
 * @param state
 * @returns
 */
export const storeIsReadyForNew = (state: TranscribeStoreState) => {
  if (state.state === 'LISTENING') return false;

  const latestTranscription = getLatestTranscription(state);

  if (
    state.transcriptions.length === 0 ||
    state.jobs.some(
      (job) =>
        job.transcriptionId === latestTranscription.startedTimestamp &&
        job.type === 'FULL'
    )
  )
    return true;

  return false;
};

/**
 * Self explanatory methinks.
 * @param state
 * @returns
 */
export const storeIsListening = (state: TranscribeStoreState) => {
  return state.state === 'LISTENING';
};

/**
 * This is an iterator for the larger specific selector below. It returns all
 * the transcriptions by groups. In this context transcription is the whole group,
 * I know it's confusing but I couldn't think of a better name.
 * @param state
 * @returns
 */
export const getTranscriptions = (state: TranscribeStoreState) => {
  const groups = new Set(
    state.transcriptions.map((transcription) => transcription.groupId)
  );

  return Array.from(groups).map((groupId) =>
    getTranscriptionForGroup(state, groupId)
  );
};

/**
 * This is a big selector. You can sub-select it and reduce re-renders, since you don't
 * usually need the whole thing.
 * @param state
 * @param groupId
 * @returns All information about a transcription group, which includes:
 * - groupId
 * - fullTranscription: The actual full transcription posted at the end.
 * - streamTranscription: The stream of partial transcriptions, but full transcriptions
 * are used when available.
 * - completedTranscriptionTimeMs: How much previous completed transcriptions have taken.
 * - lastStartedTime: If a transcription is running, when did it start? This is the
 * most render-efficient method I could find to keep a running counter.
 * - active: Is this transcription still active? Just checking if it's in the
 * current group.
 * - firstStartedAt: When did this transcription group start?
 */
export const getTranscriptionForGroup = (
  state: TranscribeStoreState,
  groupId: number
) => {
  const transcriptions = state.transcriptions
    .filter((transcription) => transcription.groupId === groupId)
    .sort((a, b) => a.startedTimestamp - b.startedTimestamp);
  const transcriptionIds = transcriptions.map(
    (transcription) => transcription.startedTimestamp
  );
  const jobs = state.jobs.filter((job) =>
    transcriptionIds.includes(job.transcriptionId)
  );

  const transcripts = transcriptions.map((transcription, index) => {
    const fullJob = jobs.find(
      (job) =>
        job.transcriptionId === transcription.startedTimestamp &&
        job.type === 'FULL'
    );
    const partialJobs = jobs.filter(
      (job) =>
        job.transcriptionId === transcription.startedTimestamp &&
        job.type === 'PARTIAL'
    );
    const pendingPartialJobs = partialJobs.some(
      (job) => job.state === 'PROCESSING'
    );

    let fullTranscript: string | undefined =
      fullJob && fullJob.state === 'TRANSCRIBED' && fullJob.transcription
        ? fullJob.transcription
        : undefined;
    let streamTranscript: string | undefined = partialJobs
      .filter(
        (partialJob) =>
          partialJob.state === 'TRANSCRIBED' && partialJob.transcription
      )
      .map((partialJob) => partialJob.transcription)
      .join(' ');

    if (index < transcriptions.length - 1) {
      // This is not the last one
      if ((!fullJob || fullJob.state !== 'TRANSCRIBED') && !pendingPartialJobs)
        fullTranscript = streamTranscript;
    } else {
      // This is the last one we should wait
      if (
        (!fullJob || fullJob.state === 'FAILED' || fullJob.state === 'EMPTY') &&
        !pendingPartialJobs
      )
        fullTranscript = streamTranscript;
    }

    return {
      fullTranscript,
      streamTranscript,
    };
  });

  const fullTranscription = transcripts
    .map((transcript) => transcript.fullTranscript)
    .join(' ');
  const streamTranscription = transcripts
    .map((transcript) => transcript.streamTranscript || '...')
    .join(' ');

  const completedTranscriptionTimeMs = transcriptions
    .filter((transcription) => !!transcription.endedTimestamp)
    .map(
      (transcription) =>
        transcription.endedTimestamp! - transcription.startedTimestamp
    )
    .reduce((a, b) => a + b, 0);

  const unfinishedTranscriptions = transcriptions.filter(
    (transcription) => !transcription.endedTimestamp
  );

  const pendingJobs = jobs.filter((job) => job.state === 'PROCESSING').length;

  const lastUnfinishedStartedTime =
    unfinishedTranscriptions.length > 0
      ? new Date(
          unfinishedTranscriptions[
            unfinishedTranscriptions.length - 1
          ].startedTimestamp
        )
      : null;

  const active = groupId === state.currentTranscriptionGroup;

  // TODO: Add a failed property here that we can use to skip transcriptions entirely if they fail for some reason as they occasionally do

  return {
    groupId,
    fullTranscription,
    streamTranscription,
    completedTranscriptionTimeMs,
    pendingJobs,
    lastStartedTime: lastUnfinishedStartedTime,
    active,
    firstStartedAt:
      (transcriptions.length && new Date(transcriptions[0].startedTimestamp)) ||
      null,
  };
};

// TODO: This store implementation fails if there is no transcribe callback, which happens if there was just silence the entire time. We need to find a fix. One way is to change use-whisper to log when that happens, or call onTranscribing anyway, another is to just set a timeout which checks for a transcription job after - say 2 seconds - and deletes the transcription (or uses streamed transcriptions) if nothing shows up. This is also an edge case that can happen if ffmpeg fails or onTranscribing just doesn't get called somehow - so it's worth fixing properly.
