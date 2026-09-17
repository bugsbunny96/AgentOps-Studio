/**
 * L3.F1 — HomePage (Public Landing Page)
 * Route: / (public, no auth required)
 *
 * Composition root only — each section lives in `landing/sections/*` and
 * shares one small design system (`landing/tokens.ts` + `landing/primitives.tsx`).
 *
 * Design: dark SaaS, 3D CSS hero, aurora blobs, spotlight-bordered bento grid,
 *         voice wave bars, marquee, scroll reveals — zero external JS deps.
 *
 * Performance guarantee:
 *   - All animations use transform/opacity only (compositor thread, no layout reflow)
 *   - Intersection Observer for scroll reveals (no scroll event listeners on scroll-heavy work)
 *   - will-change: transform on aurora blobs only
 *   - prefers-reduced-motion is respected globally (see landing/landing.css)
 */
import './landing/landing.css';
import { ScrollProgressBar } from './landing/primitives';
import { HeroSection } from './landing/sections/HeroSection';
import { MarqueeSection } from './landing/sections/MarqueeSection';
import { PoweredBySection } from './landing/sections/PoweredBySection';
import { HowItWorksSection } from './landing/sections/HowItWorksSection';
import { FeaturesSection } from './landing/sections/FeaturesSection';
import { CallIntelligenceSection } from './landing/sections/CallIntelligenceSection';
import { VoicesSection } from './landing/sections/VoicesSection';
import { TestimonialsSection } from './landing/sections/TestimonialsSection';
import { PricingSection } from './landing/sections/PricingSection';
import { CTASection } from './landing/sections/CTASection';

export default function HomePage() {
  return (
    <div className="landing-page">
      <ScrollProgressBar />
      <HeroSection />
      <MarqueeSection />
      <PoweredBySection />
      <HowItWorksSection />
      <FeaturesSection />
      <CallIntelligenceSection />
      <VoicesSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
    </div>
  );
}
