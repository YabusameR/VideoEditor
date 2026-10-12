// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  items: [] as Array<Record<string, unknown>>,
  updateItem: vi.fn(),
  getTranscript: vi.fn(),
  insertTranscriptAsCaptions: vi.fn(),
  runMediaTranscriptionJob: vi.fn(),
}))

vi.mock('@/features/media-library/deps/timeline-stores', () => ({
  useTimelineStore: {
    getState: () => ({ items: mocks.items, fps: 30, updateItem: mocks.updateItem }),
  },
}))

vi.mock('./media-transcription-service', () => ({
  mediaTranscriptionService: {
    getTranscript: mocks.getTranscript,
    insertTranscriptAsCaptions: mocks.insertTranscriptAsCaptions,
  },
}))

vi.mock('./media-transcription-runner', () => ({
  runMediaTranscriptionJob: mocks.runMediaTranscriptionJob,
}))

import { countCaptionTargets, generateTimelineCaptions } from './auto-captions'

describe('generateTimelineCaptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getTranscript.mockResolvedValue(null)
    mocks.runMediaTranscriptionJob.mockResolvedValue({ status: 'completed' })
    mocks.insertTranscriptAsCaptions.mockResolvedValue({ insertedItemCount: 1 })
    mocks.items = [
      { id: 'v1', type: 'video', mediaId: 'talk', durationInFrames: 300 },
      { id: 'a1', type: 'audio', mediaId: 'talk', durationInFrames: 300 },
      { id: 'sfx', type: 'audio', mediaId: 'pop', durationInFrames: 15 },
      { id: 'bgm', type: 'audio', mediaId: 'song', durationInFrames: 600 },
    ]
  })

  it('captions video clips and long standalone audio, skipping short sound effects', async () => {
    expect(countCaptionTargets()).toBe(2)

    const result = await generateTimelineCaptions({ model: 'whisper-small', language: 'ja' })

    expect(result).toEqual({ captionedMediaCount: 2, failedMediaCount: 0 })
    expect(mocks.runMediaTranscriptionJob).toHaveBeenCalledWith('talk', {
      model: 'whisper-small',
      language: 'ja',
    })
    // Only the video clip is captioned for "talk" — its linked audio would duplicate it.
    expect(mocks.insertTranscriptAsCaptions).toHaveBeenCalledWith(
      'talk',
      expect.objectContaining({ clipIds: ['v1'], replaceExisting: true }),
    )
  })

  it('places captions as separate items with the requested starting style', async () => {
    await generateTimelineCaptions({
      model: 'whisper-small',
      defaultStyle: { fontFamily: 'Noto Sans JP' },
    })

    expect(mocks.insertTranscriptAsCaptions).toHaveBeenCalledWith(
      'talk',
      expect.objectContaining({ defaultStyle: { fontFamily: 'Noto Sans JP' } }),
    )
  })

  it('turns off clip-attached captions so text is not shown twice', async () => {
    const transcriptCaptions = { type: 'transcript', enabled: true, mediaId: 'talk', cues: [] }
    mocks.items = [
      { id: 'v1', type: 'video', mediaId: 'talk', durationInFrames: 300, transcriptCaptions },
      { id: 'a1', type: 'audio', mediaId: 'talk', durationInFrames: 300, transcriptCaptions },
    ]

    await generateTimelineCaptions({ model: 'whisper-small' })

    expect(mocks.updateItem).toHaveBeenCalledTimes(2)
    for (const id of ['v1', 'a1']) {
      expect(mocks.updateItem).toHaveBeenCalledWith(id, {
        transcriptCaptions: expect.objectContaining({ enabled: false }),
      })
    }
  })

  it('reuses an existing transcript from the same model', async () => {
    mocks.getTranscript.mockResolvedValue({ model: 'whisper-small' })

    await generateTimelineCaptions({ model: 'whisper-small' })

    expect(mocks.runMediaTranscriptionJob).not.toHaveBeenCalled()
    expect(mocks.insertTranscriptAsCaptions).toHaveBeenCalledTimes(2)
  })

  it('counts failures without stopping the other sources', async () => {
    mocks.insertTranscriptAsCaptions
      .mockRejectedValueOnce(new Error('no overlap'))
      .mockResolvedValueOnce({ insertedItemCount: 1 })

    const result = await generateTimelineCaptions({ model: 'whisper-small' })

    expect(result).toEqual({ captionedMediaCount: 1, failedMediaCount: 1 })
  })
})
