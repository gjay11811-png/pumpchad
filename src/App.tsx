import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion'
import { About } from './components/About'
import { Chadverse } from './components/Chadverse'
import { ChadverseTeaser } from './components/ChadverseTeaser'
import { Progress } from './components/Progress'
import { Commandments } from './components/Commandments'
import { Community } from './components/Community'
import { Cursor } from './components/Cursor'
import { Diagnostics } from './components/Diagnostics'
import { Faq } from './components/Faq'
import { GameStatus } from './components/GameStatus'
import { Launch } from './components/Launch'
import { LaunchProvider } from './launch'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { HowToBuy } from './components/HowToBuy'
import { Lore } from './components/Lore'
import { MoodStrip, Ticker } from './components/Strips'
import { Tokenomics } from './components/Tokenomics'

export default function App() {
  return (
    <LaunchProvider>
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
            <Launch />
            <About />
            <ChadverseTeaser />
            <GameStatus />
            <Progress />
            <Community />
            <Diagnostics />
            <Commandments />
            <Tokenomics />
            <HowToBuy />
            <Lore />
            <Chadverse />
            <Faq />
          </main>
          <Footer />
          <Cursor />
        </div>
      </MotionConfig>
    </LazyMotion>
    </LaunchProvider>
  )
}
