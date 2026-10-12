import { forwardRef, useEffect, useRef, useState, type ComponentProps } from 'react'
import { Textarea } from '@/components/ui/textarea'

type ImeSafeTextareaProps = Omit<ComponentProps<'textarea'>, 'value' | 'onChange'> & {
  value: string
  /** Called with the new text — never while an IME composition is in progress. */
  onValueChange: (value: string) => void
}

/**
 * Textarea for text that is stored outside React state (timeline items).
 *
 * Writing every keystroke to a store and feeding the stored value straight
 * back into a controlled textarea breaks IME input (Japanese, Chinese,
 * Korean): the round trip resets the field mid-composition, so typing "de"
 * for 「で」 commits "ｄ" and starts a new composition for 「え」. This keeps a
 * local draft, holds commits until composition ends, and only adopts the
 * external value when it changes from somewhere else (undo, another panel).
 */
export const ImeSafeTextarea = forwardRef<HTMLTextAreaElement, ImeSafeTextareaProps>(
  function ImeSafeTextarea(
    { value, onValueChange, onCompositionStart, onCompositionEnd, ...props },
    ref,
  ) {
    const [draft, setDraft] = useState(value)
    const composingRef = useRef(false)
    // The last value this field committed; an incoming `value` equal to it is
    // our own edit echoing back, not an outside change.
    const lastCommittedRef = useRef(value)

    useEffect(() => {
      if (composingRef.current || value === lastCommittedRef.current) return
      lastCommittedRef.current = value
      setDraft(value)
    }, [value])

    const commit = (next: string) => {
      if (next === lastCommittedRef.current) return
      lastCommittedRef.current = next
      onValueChange(next)
    }

    return (
      <Textarea
        {...props}
        ref={ref}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          // `isComposing` covers browsers that fire compositionstart late.
          if (!composingRef.current && !(event.nativeEvent as InputEvent).isComposing) {
            commit(event.target.value)
          }
        }}
        onCompositionStart={(event) => {
          composingRef.current = true
          onCompositionStart?.(event)
        }}
        onCompositionEnd={(event) => {
          composingRef.current = false
          commit(event.currentTarget.value)
          onCompositionEnd?.(event)
        }}
      />
    )
  },
)
