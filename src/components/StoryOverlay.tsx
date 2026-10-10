import { useEffect } from 'react'
import type { Dispatch } from 'react'
import type { ReachabilitySummary } from '../engine/types'
import { formatIst12 } from '../sim/clock'
import { CHAPTER_DWELL_MS, STORY_CHAPTERS, UNLOCK_DWELL_MS } from '../state/story'
import type { SimAction, StoryRuntime } from '../state/store'

interface StoryOverlayProps {
  story: StoryRuntime
  nowMs: number
  summary: ReachabilitySummary
  dispatch: Dispatch<SimAction>
}

function plural(n: number, word: string): string {
  return `${word}${n === 1 ? '' : 's'}`
}

/**
 * The guided tour's stage (spec): chapter card with live clock and live
 * engine counts, pause/resume/prev/next/exit, and the driver that advances
 * chapters — including the unlock chapter's two beats (ghost, then the
 * probe's relaxation applied and the field blooms). The overlay only ever
 * dispatches story actions; every other interaction on the page exits
 * story mode by reducer rule, landing in the live sim at that state.
 */
export function StoryOverlay({ story, nowMs, summary, dispatch }: StoryOverlayProps) {
  const chapter = STORY_CHAPTERS[story.chapterIndex]

  // The chapter driver: one timer per phase. Story-driven dispatches only —
  // the tour never pretends to be a hand.
  useEffect(() => {
    if (!story.playing) return
    const applyUnlock = chapter.unlock !== undefined && !story.unlockApplied
    // A chapter with an applied unlock blooms for a shorter beat; plain
    // chapters dwell the full chapter time before advancing.
    const delay = !applyUnlock && chapter.unlock !== undefined ? UNLOCK_DWELL_MS : CHAPTER_DWELL_MS
    const timer = setTimeout(() => {
      if (applyUnlock) dispatch({ type: 'storyUnlock' })
      else dispatch({ type: 'storyStep', delta: 1 })
    }, delay)
    return () => clearTimeout(timer)
  }, [dispatch, chapter, story.playing, story.unlockApplied])

  return (
    <div className="story-overlay" data-testid="story-overlay" role="region" aria-label="Guided story">
      <div className="story-card">
        <div className="story-meta">
          <span className="story-step">
            Chapter {story.chapterIndex + 1} of {STORY_CHAPTERS.length}
          </span>
          <span className="story-clock" data-testid="story-clock">
            {formatIst12(nowMs)}
          </span>
          <span className="story-count" data-testid="story-count">
            <strong>{summary.reachableCount}</strong> {plural(summary.reachableCount, 'destination')} ·{' '}
            <strong>{summary.totalJourneys}</strong> {plural(summary.totalJourneys, 'journey')}
          </span>
        </div>
        <h2 className="story-title" data-testid="story-title">
          {chapter.title}
        </h2>
        <p className="story-caption" data-testid="story-caption">
          {chapter.caption}
        </p>
        {chapter.unlock !== undefined && (
          <p className="story-unlock-state" data-testid="story-unlock-state">
            {story.unlockApplied ? 'Unlock applied — the field blooms back.' : 'Ghosted — what would it take?'}
          </p>
        )}
        <div className="story-controls">
          <button
            type="button"
            className="story-btn"
            onClick={() => dispatch({ type: 'storyStep', delta: -1 })}
            aria-label="Previous chapter"
          >
            ⏮
          </button>
          <button
            type="button"
            className="story-btn story-play"
            onClick={() => dispatch({ type: 'storyToggle' })}
            aria-label={story.playing ? 'Pause the story' : 'Resume the story'}
          >
            {story.playing ? '❚❚' : '▶'}
          </button>
          <button
            type="button"
            className="story-btn"
            onClick={() => dispatch({ type: 'storyStep', delta: 1 })}
            aria-label="Next chapter"
          >
            ⏭
          </button>
          <button
            type="button"
            className="story-btn story-exit"
            onClick={() => dispatch({ type: 'storyStop' })}
            aria-label="Exit the story into the live simulation"
          >
            Exit
          </button>
        </div>
        <div className="story-progress" aria-hidden="true">
          {STORY_CHAPTERS.map((ch, i) => (
            <span
              key={ch.id}
              className={`story-dot${i === story.chapterIndex ? ' current' : ''}${i < story.chapterIndex ? ' done' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
