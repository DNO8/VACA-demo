'use client';

import { Joyride, EVENTS, type EventData, type Options, type Step, type Styles } from 'react-joyride';
import { useLang } from '@/lib/i18n';

export type { Step };

// La versión instalada de react-joyride soporta floaterProps en runtime, pero sus tipos no lo incluyen.
const JoyrideAny = Joyride as any;

const options: Partial<Options> = {
  arrowColor: '#1E3240',
  backgroundColor: '#1E3240',
  primaryColor: '#FD802E',
  textColor: '#FFFFFF',
  overlayColor: 'rgba(16, 24, 32, 0.78)',
  spotlightRadius: 12,
  spotlightPadding: 6,
  showProgress: true,
  skipBeacon: true,
  buttons: ['back', 'skip', 'primary'],
  zIndex: 10000,
};

const floaterProps = {
  disableAnimation: false,
  options: {
    placement: 'auto' as const,
    preventOverflow: { boundariesElement: 'window' as const },
  },
};

const styles: Partial<Styles> = {
  tooltip: {
    borderRadius: 14,
    border: '1px solid rgba(166, 194, 212, 0.35)',
    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(253, 128, 46, 0.1)',
    padding: 18,
    backdropFilter: 'blur(20px)',
  },
  tooltipContainer: {
    textAlign: 'left',
  },
  tooltipTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 4,
  },
  tooltipContent: {
    padding: '8px 0',
    fontSize: 13,
    lineHeight: 1.6,
    color: '#A6C2D4',
  },
  buttonPrimary: {
    borderRadius: 8,
    fontWeight: 700,
    color: '#101820',
    padding: '8px 16px',
    fontSize: 13,
  },
  buttonBack: {
    color: '#A6C2D4',
    fontSize: 13,
    marginRight: 8,
  },
  buttonSkip: {
    color: '#6A8BA3',
    fontSize: 12,
  },
  spotlight: {
    rx: 12,
    ry: 12,
  },
};

const LOCALES = {
  es: {
    back: 'Atrás',
    close: 'Cerrar',
    last: 'Entendido',
    next: 'Siguiente',
    nextWithProgress: 'Siguiente ({current}/{total})',
    skip: 'Saltar tour',
  },
  en: {
    back: 'Back',
    close: 'Close',
    last: 'Got it',
    next: 'Next',
    nextWithProgress: 'Next ({current}/{total})',
    skip: 'Skip tour',
  },
} as const;

interface TourProps {
  steps: Step[];
  run: boolean;
  onFinish: () => void;
}

export default function Tour({ steps, run, onFinish }: TourProps) {
  const { lang } = useLang();
  const handleEvent = (data: EventData) => {
    if (data.type === EVENTS.TOUR_END) {
      onFinish();
    }
  };

  return (
    <JoyrideAny
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      options={options}
      styles={styles}
      locale={LOCALES[lang]}
      floaterProps={floaterProps}
    />
  );
}
