'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'

// This component floats above the entire Live Arena, with pointer-events: none
// It handles rendering floating emojis that drift up from the bottom left

interface Props {
  matchId: number
  trigger?: string
}

interface FloatingEmoji {
  id: string
  emoji: string
  startX: number
}

export default function LiveGraphicsEngine({ matchId, trigger }: Props) {
  // State for lightweight floating emojis
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([])

  useEffect(() => {
    if (trigger) {
      // The trigger format is "emoji:randomString"
      const emoji = trigger.split(':')[0]
      if (emoji) {
        triggerFloatingEmoji(emoji)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  const triggerFloatingEmoji = (emoji: string) => {
    // 6 to 8 emojis per click so it's highly noticeable
    const count = Math.floor(Math.random() * 3) + 6
    
    const newEmojis = Array.from({ length: count }).map(() => ({
      id: Math.random().toString(36).substr(2, 9),
      emoji,
      // Random X pos across the entire screen width (10vw to 90vw)
      startX: 10 + Math.random() * 80,
      // 2 to 3 seconds duration
      duration: 2.0 + Math.random() * 1.0
    }))
    
    // Cap at 200 to prevent device lag
    setFloatingEmojis(prev => [...prev.slice(-190), ...newEmojis])
    
    // Auto remove after animation completes
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => !newEmojis.find(n => n.id === e.id)))
    }, 4000)
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, overflow: 'hidden' }}>
      <AnimatePresence>
        {floatingEmojis.map((e: any) => {
          // Gentle wiggle and drifting
          const wiggle1 = e.startX - 8 + Math.random() * 16
          const wiggle2 = e.startX - 8 + Math.random() * 16

          return (
            <motion.div
              key={e.id}
              initial={{ y: '100vh', x: `${e.startX}vw`, opacity: 0, scale: 0.5 }}
              animate={{ 
                y: '-20vh', 
                x: [`${e.startX}vw`, `${wiggle1}vw`, `${wiggle2}vw`, `${e.startX}vw`], 
                opacity: [0, 0.8, 0.8, 0],
                scale: [0.5, 1.2, 1.5, 1.0]
              }}
              transition={{ duration: e.duration, ease: "easeInOut" }}
              style={{ position: 'absolute', fontSize: '2rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
            >
              {e.emoji}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
