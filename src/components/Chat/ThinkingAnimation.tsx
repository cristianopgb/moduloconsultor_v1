import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function ThinkingAnimation() {
  const [msg, setMsg] = useState('Pensando… organizando suas ideias')
  useEffect(() => {
    const alt = [
      'Pensando… organizando suas ideias',
      'Analisando contexto…',
      'Conectando informações…',
      'Estruturando resposta…'
    ]
    let i = 0
    const id = setInterval(() => { i = (i + 1) % alt.length; setMsg(alt[i]) }, 1400)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex justify-center">
      <div className="px-3 py-2 rounded-2xl bg-gray-800/70 border border-gray-700 text-gray-100 flex items-center gap-2 shadow">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="relative overflow-hidden inline-block">
          <span className="animate-[shimmer_1.8s_linear_infinite] bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-[length:200%_100%] bg-clip-text text-transparent">
            {msg}
          </span>
        </span>
      </div>

      <style>
        {`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}
      </style>
    </div>
  )
}
