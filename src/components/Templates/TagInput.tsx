import React, { useState, KeyboardEvent } from 'react'
import { X, Plus } from 'lucide-react'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  maxTags?: number
  suggestions?: string[]
}

export function TagInput({ tags, onChange, placeholder = 'Adicionar tag...', maxTags = 10, suggestions = [] }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filteredSuggestions = suggestions.filter(
    (sug) => !tags.includes(sug) && sug.toLowerCase().includes(inputValue.toLowerCase())
  )

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed) return
    if (tags.includes(trimmed)) {
      setInputValue('')
      return
    }
    if (tags.length >= maxTags) {
      setInputValue('')
      return
    }

    onChange([...tags, trimmed])
    setInputValue('')
    setShowSuggestions(false)
  }

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  return (
    <div className="w-full">
      {/* Tags Display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map((tag, index) => (
            <div
              key={index}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-full text-sm group hover:bg-blue-600/30 transition-colors"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="hover:text-blue-100 transition-colors"
                title="Remover tag"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setShowSuggestions(e.target.value.length > 0)
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(inputValue.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={tags.length >= maxTags ? `Máximo de ${maxTags} tags atingido` : placeholder}
            disabled={tags.length >= maxTags}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => addTag(inputValue)}
            disabled={!inputValue.trim() || tags.length >= maxTags}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
            title="Adicionar tag"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
            {filteredSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => addTag(suggestion)}
                className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Helper Text */}
      <p className="text-xs text-gray-400 mt-2">
        {tags.length}/{maxTags} tags • Pressione Enter para adicionar
      </p>
    </div>
  )
}
