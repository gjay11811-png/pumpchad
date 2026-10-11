import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion'
import { About } from './components/About'
import { Chadverse } from './components/Chadverse'
import { Commandments } from './components/Commandments'
import { Community } from './components/Community'
import { Cursor } from './components/Cursor'
import { Diagnostics } from './components/Diagnostics'
import { Faq } from './components/Faq'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { HowToBuy } from './components/HowToBuy'
import { Lore } from './components/Lore'
import { MoodStrip, Ticker } from './components/Strips'
import { Tokenomics } from './components/Tokenomics'

export default function App() {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div className="grain relative">
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-pump focus:px-5 focus:py-3 focus:text-ink">
            Skip to content
          </a>
          <Header />
          <main id="main">
            <Hero />
            <MoodStrip />
            <Ticker />
            <About />
            <Diagnostics />
            <Commandments />
            <Tokenomics />
            <HowToBuy />
            <Lore />
            <Chadverse />
            <Community />
            <Faq />
          </main>
          <Footer />
          <Cursor />
        </div>
      </MotionConfig>
    </LazyMotion>
  )
}
