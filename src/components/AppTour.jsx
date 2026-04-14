import React, { useState, useEffect } from 'react';

const TOUR_STEPS = [
  {
    target: null, // Global welcome
    title: 'Welcome to DebtEase! 🚀',
    content: 'Simplify shared expenses with our AI-powered workspace. Let us show you around.',
  },
  {
    target: '#tour-add-receipt',
    title: 'Smart Receipt Wizard',
    content: 'Scan your documents using OCR. We automatically extract totals and suggest members!',
  },
  {
    target: '#tour-stats',
    title: 'Live Group Stats',
    content: 'Keep track of everyone in the group and the optimized total settlement amount.',
  },
  {
    target: '#tour-graph',
    title: 'Visual Settlement Plan',
    content: 'See exactly how we reduced chaotic splits into a clean, minimal transaction list.',
  },
  {
    target: '#tour-add-expense-manual',
    title: 'Voice & Manual Entry',
    content: 'Prefer typing? Or speaking? Click here to add expenses via Hinglish voice commands.',
  },
  {
    target: null, // Final wrap-up
    title: 'All Set! 🏁',
    content: 'Go ahead and create your first group expense or upload a receipt to start.',
  }
];

function AppTour() {
  const [step, setStep] = useState(-1);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const isComplete = localStorage.getItem('debtEaseTourComplete');
    if (!isComplete) {
      setTimeout(() => setStep(0), 1200);
    }
  }, []);

  // Lock body scroll
  useEffect(() => {
    if (step >= 0) {
      document.body.classList.add('tour-open');
    } else {
      document.body.classList.remove('tour-open');
    }
    return () => document.body.classList.remove('tour-open');
  }, [step]);

  useEffect(() => {
    if (step >= 0 && TOUR_STEPS[step]?.target) {
      const el = document.querySelector(TOUR_STEPS[step].target);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const r = el.getBoundingClientRect();
          setRect(r);
        }, 300);
      } else {
        setRect(null);
      }
    } else {
      setRect(null);
    }
  }, [step]);

  const handleNext = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    localStorage.setItem('debtEaseTourComplete', 'true');
    setStep(-1);
  };

  if (step === -1) return null;

  const current = TOUR_STEPS[step];

  return (
    <div className="tour-overlay">
      {/* Dimmed background highlight */}
      {rect && (
        <div 
          className="tour-highlight" 
          style={{
            top: rect.top - 10,
            left: rect.left - 10,
            width: rect.width + 20,
            height: rect.height + 20
          }}
        />
      )}

      <div 
        className={`tour-popover ${rect ? 'positioned' : 'centered'}`}
        style={rect ? (() => {
          const popoverHeight = 340;
          const spaceBelow = window.innerHeight - rect.bottom;
          const spaceAbove = rect.top;
          
          let top = rect.bottom + 20;
          if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
            top = rect.top - popoverHeight - 20;
          }
          
          return {
            top: Math.max(20, Math.min(top, window.innerHeight - popoverHeight - 20)),
            left: Math.max(20, Math.min(rect.left, window.innerWidth - 460))
          };
        })() : {}}
      >
        <div className="tour-popover-header">
           <span className="tour-badge">Step {step + 1} of {TOUR_STEPS.length}</span>
           <button className="tour-skip" onClick={handleComplete}>Skip Tour</button>
        </div>
        
        <h3 className="tour-title">{current.title}</h3>
        <p className="tour-content">{current.content}</p>

        <div className="tour-footer">
          <button 
            className="button-secondary" 
            onClick={() => setStep(step - 1)} 
            disabled={step === 0}
          >
            ← Back
          </button>
          <button className="button-primary" onClick={handleNext}>
            {step === TOUR_STEPS.length - 1 ? 'Get Started! 🎉' : 'Next Step →'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AppTour;
