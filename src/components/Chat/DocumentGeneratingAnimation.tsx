import React, { useEffect, useRef, useState } from 'react'

export default function DocumentGeneratingAnimation({ log = [] as string[] }) {
  const [pct, setPct] = useState(5)
  useEffect(() => {
    const id = setInterval(() => {
      setPct(prev => (prev >= 96 ? 96 : prev + Math.random() * 8))
    }, 650)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="my-6 flex flex-col items-center text-center text-gray-200">
      {/* Bot torso */}
      <svg width="120" height="120" viewBox="0 0 120 120" className="mb-2">
        <defs>
          <filter id="glow"><feGaussianBlur stdDeviation="3" result="colored"/><feMerge><feMergeNode in="colored"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <circle cx="60" cy="60" r="36" fill="#0ea5e9" opacity="0.14"/>
        <rect x="30" y="42" rx="12" ry="12" width="60" height="44" fill="#111827" stroke="#334155" />
        {/* antena */}
        <line x1="60" y1="36" x2="60" y2="42" stroke="#7dd3fc" strokeWidth="3">
          <animate attributeName="y1" values="34;36;34" dur="2.2s" repeatCount="indefinite"/>
        </line>
        <circle cx="60" cy="34" r="3" fill="#7dd3fc" filter="url(#glow)">
          <animate attributeName="r" values="2.4;3.4;2.4" dur="2.2s" repeatCount="indefinite"/>
        </circle>
        {/* olhos */}
        <rect x="43" y="56" width="34" height="10" rx="5" fill="#0b1220" />
        <circle cx="56" cy="61" r="4" fill="#60a5fa">
          <animate attributeName="cx" values="56;58;56" dur="1.8s" repeatCount="indefinite"/>
        </circle>
        <circle cx="68" cy="61" r="4" fill="#60a5fa">
          <animate attributeName="cx" values="68;66;68" dur="1.8s" repeatCount="indefinite"/>
        </circle>
      </svg>

      <div className="text-lg font-semibold mb-1">Estamos montando seu documento…</div>
      <div className="text-xs text-gray-400 mb-4">otimizando estrutura, estilo e referências</div>

      {/* barra */}
      <div className="w-[520px] max-w-[88vw] h-3 rounded-full bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-fuchsia-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {log?.length ? (
        <div className="mt-4 w-[520px] max-w-[88vw] text-left text-xs text-gray-400 bg-gray-800/60 border border-gray-700/60 rounded p-3">
          {log.slice(-6).map((l, i) => (<div key={i}>• {l}</div>))}
        </div>
      ) : null}
    </div>
  )
}
