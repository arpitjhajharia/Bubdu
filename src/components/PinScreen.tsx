import { useState } from 'react'

interface Props {
  onSubmit: (pin: string) => Promise<boolean>
}

export default function PinScreen({ onSubmit }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleKey(digit: string) {
    if (loading) return
    setError(false)
    const next = pin + digit
    setPin(next)
    if (next.length === 6) {
      setLoading(true)
      const ok = await onSubmit(next)
      if (!ok) {
        setError(true)
        setPin('')
      }
      setLoading(false)
    }
  }

  function handleDelete() {
    setPin(p => p.slice(0, -1))
    setError(false)
  }

  return (
    <div className="min-h-screen bg-purple-50 flex flex-col items-center justify-center px-6">
      <div className="mb-8 text-center">
        <div className="text-5xl mb-3">🍼</div>
        <h1 className="text-2xl font-bold text-purple-800">Bubdu Tracker</h1>
        <p className="text-purple-500 text-sm mt-1">Enter PIN to continue</p>
      </div>

      <div className="flex gap-3 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all ${
              i < pin.length
                ? error
                  ? 'bg-red-500'
                  : 'bg-purple-600'
                : 'bg-purple-200'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-red-500 text-sm mb-4 animate-pulse">Incorrect PIN</p>
      )}

      <div className="grid grid-cols-3 gap-4 w-64">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
          <button
            key={i}
            onClick={() => k === '⌫' ? handleDelete() : k ? handleKey(k) : undefined}
            className={`h-16 rounded-2xl text-xl font-semibold transition-all active:scale-95 ${
              !k
                ? 'pointer-events-none'
                : k === '⌫'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'bg-white text-purple-900 shadow-sm hover:bg-purple-100'
            }`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}
