'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

export default function AnimationDemo() {
  const [key, setKey] = useState(0)

  // Replay animation
  const triggerAnimation = () => setKey(prev => prev + 1)

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0A0C10', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
      
      {/* Controls */}
      <div style={{ position: 'absolute', top: 20, zIndex: 100 }}>
        <button 
          onClick={triggerAnimation}
          style={{ padding: '12px 24px', background: 'var(--cup-gold)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
        >
          REPLAY ANIMATION ⚽
        </button>
      </div>

      <div key={key} style={{ width: '100%', height: '100%', position: 'relative' }}>
        
        {/* Dark Vignette Overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ duration: 0.3 }}
          style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, transparent 20%, #0A0C10 90%)', pointerEvents: 'none' }}
        />

        {/* The Net */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, x: 100 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.5, type: 'spring' }}
          style={{ position: 'absolute', right: '5%', top: '30%', width: '150px', height: '40vh', border: '4px solid rgba(255,255,255,0.2)', borderRight: 'none', borderRadius: '10px 0 0 10px', background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, transparent 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {/* Net Mesh Graphic */}
          <div style={{ width: '100%', height: '100%', backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0, rgba(255,255,255,0.1) 2px, transparent 2px, transparent 10px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.1) 0, rgba(255,255,255,0.1) 2px, transparent 2px, transparent 10px)' }} />
        </motion.div>

        {/* The Ball */}
        <motion.div
          initial={{ x: '-20vw', y: '60vh', scale: 0.5, rotate: 0 }}
          animate={{ x: '80vw', y: '40vh', scale: 1.5, rotate: 720 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          style={{ position: 'absolute', fontSize: '64px', filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.8))', zIndex: 10 }}
        >
          ⚽
        </motion.div>

        {/* Impact Shockwave */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5, x: '80vw', y: '40vh' }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 3, 5] }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.8 }}
          style={{ position: 'absolute', width: '100px', height: '100px', borderRadius: '50%', border: '4px solid var(--cup-gold)', transformOrigin: 'center' }}
        />

        {/* "GOAL!" Text Slam */}
        <motion.div
          initial={{ opacity: 0, scale: 5, y: -200 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.9, type: 'spring', stiffness: 200, damping: 12 }}
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 20 }}
        >
          <motion.h1
            animate={{ textShadow: ['0 0 0px #fff', '0 0 40px var(--cup-gold)', '0 0 0px #fff'] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            style={{ fontSize: '15vw', margin: 0, color: 'white', fontWeight: 900, fontStyle: 'italic', WebkitTextStroke: '4px var(--cup-gold)', letterSpacing: '-2px' }}
          >
            GOAL!
          </motion.h1>
        </motion.div>

        {/* Confetti / Sparks */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: '80vw', y: '40vh', scale: 0 }}
            animate={{ 
              opacity: [0, 1, 0], 
              x: `calc(80vw + ${(Math.random() - 0.5) * 400}px)`, 
              y: `calc(40vh + ${(Math.random() - 0.5) * 400}px)`,
              scale: Math.random() * 1.5 + 0.5
            }}
            transition={{ duration: 0.8, delay: 0.8 + Math.random() * 0.2, ease: "easeOut" }}
            style={{ position: 'absolute', width: '12px', height: '12px', background: i % 2 === 0 ? 'var(--cup-gold)' : 'white', borderRadius: '50%', boxShadow: '0 0 10px var(--cup-gold)' }}
          />
        ))}

      </div>
    </div>
  )
}
