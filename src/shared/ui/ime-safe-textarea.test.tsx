import { useState } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { fireEvent, render, screen } from '@testing-library/react'
import { ImeSafeTextarea } from './ime-safe-textarea'

describe('ImeSafeTextarea', () => {
  it('does not commit while an IME composition is in progress', () => {
    const onValueChange = vi.fn()
    render(<ImeSafeTextarea aria-label="text" value="" onValueChange={onValueChange} />)
    const field = screen.getByLabelText('text') as HTMLTextAreaElement

    fireEvent.compositionStart(field)
    fireEvent.change(field, { target: { value: 'ｄ' } })
    fireEvent.change(field, { target: { value: 'で' } })
    expect(onValueChange).not.toHaveBeenCalled()
    // The field keeps showing the in-progress composition.
    expect(field.value).toBe('で')

    fireEvent.compositionEnd(field)
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith('で')
  })

  it('commits plain (non-IME) typing immediately', () => {
    const onValueChange = vi.fn()
    render(<ImeSafeTextarea aria-label="text" value="" onValueChange={onValueChange} />)

    fireEvent.change(screen.getByLabelText('text'), { target: { value: 'hi' } })
    expect(onValueChange).toHaveBeenCalledWith('hi')
  })

  it('keeps the draft when its own edit echoes back, and adopts outside changes', () => {
    function Harness() {
      const [value, setValue] = useState('a')
      return (
        <>
          <ImeSafeTextarea aria-label="text" value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue('undone')}>
            outside
          </button>
        </>
      )
    }
    render(<Harness />)
    const field = screen.getByLabelText('text') as HTMLTextAreaElement

    fireEvent.change(field, { target: { value: 'ab' } })
    expect(field.value).toBe('ab')

    fireEvent.click(screen.getByRole('button', { name: 'outside' }))
    expect(field.value).toBe('undone')
  })

  it('ignores outside updates that arrive mid-composition', () => {
    const { rerender } = render(
      <ImeSafeTextarea aria-label="text" value="" onValueChange={vi.fn()} />,
    )
    const field = screen.getByLabelText('text') as HTMLTextAreaElement

    fireEvent.compositionStart(field)
    fireEvent.change(field, { target: { value: 'に' } })
    rerender(<ImeSafeTextarea aria-label="text" value="stale" onValueChange={vi.fn()} />)
    expect(field.value).toBe('に')
  })
})
