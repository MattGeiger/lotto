'use client';

import * as React from 'react';
import { motion, type Transition } from 'motion/react';

import {
  useIsInView,
  type UseIsInViewOptions,
} from '@/hooks/use-is-in-view';
import { cn } from '@/lib/utils';

const formatCharacter = (char: string) => (char === ' ' ? '\u00A0' : char);

const CHAR_STYLE: React.CSSProperties = {
  position: 'absolute',
  display: 'inline-block',
  backfaceVisibility: 'hidden',
};

type RollingTextProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  text: string;
  characterClassName?: string;
  transition?: Transition;
  delay?: number;
} & UseIsInViewOptions;

function RollingText({
  ref,
  text,
  characterClassName,
  inView = false,
  inViewMargin = '0px',
  inViewOnce = true,
  transition = { duration: 0.5, delay: 0.1, ease: 'easeOut' },
  delay = 0,
  ...props
}: RollingTextProps) {
  const { ref: localRef, isInView } = useIsInView(
    ref as React.Ref<HTMLElement>,
    {
      inView,
      inViewOnce,
      inViewMargin,
    },
  );

  const [fromText, setFromText] = React.useState(text);
  const [toText, setToText] = React.useState(text);
  const [transitionIndex, setTransitionIndex] = React.useState(0);

  React.useEffect(() => {
    if (text === toText) return;
    setFromText(toText);
    setToText(text);
    setTransitionIndex((value) => value + 1);
  }, [text, toText]);

  const fromChars = React.useMemo(() => Array.from(fromText), [fromText]);
  const toChars = React.useMemo(() => Array.from(toText), [toText]);
  const maxLength = Math.max(fromChars.length, toChars.length);
  const stepDelay = transition?.delay ?? 0;
  const shouldAnimate = transitionIndex > 0 && isInView;

  return (
    <span ref={localRef} data-slot="rolling-text" {...props}>
      {maxLength === 0 && (
        <span className={characterClassName} aria-hidden="true">
          {formatCharacter(toText)}
        </span>
      )}
      {Array.from({ length: maxLength }).map((_, index) => {
        const fromChar = fromChars[index] ?? ' ';
        const toChar = toChars[index] ?? ' ';
        const charDelay = delay / 1000 + index * stepDelay;

        if (!shouldAnimate) {
          return (
            <span
              key={`static-${index}`}
              className={cn('inline-block', characterClassName)}
              style={{ whiteSpace: 'pre' }}
              aria-hidden="true"
            >
              {formatCharacter(toChar)}
            </span>
          );
        }

        return (
          <span
            key={`animated-${transitionIndex}-${index}`}
            style={{
              position: 'relative',
              display: 'inline-block',
              perspective: '9999999px',
              transformStyle: 'preserve-3d',
              width: 'auto',
              whiteSpace: 'pre',
            }}
            aria-hidden="true"
          >
            <motion.span
              className={cn('inline-block', characterClassName)}
              style={{
                ...CHAR_STYLE,
                transformOrigin: '50% 25%',
              }}
              initial={{ rotateX: 0 }}
              animate={{ rotateX: 90 }}
              transition={{
                ...transition,
                delay: charDelay,
              }}
            >
              {formatCharacter(fromChar)}
            </motion.span>
            <motion.span
              className={cn('inline-block', characterClassName)}
              style={{
                ...CHAR_STYLE,
                transformOrigin: '50% 100%',
              }}
              initial={{ rotateX: 90 }}
              animate={{ rotateX: 0 }}
              transition={{
                ...transition,
                delay: charDelay + 0.3,
              }}
            >
              {formatCharacter(toChar)}
            </motion.span>
            <span className={characterClassName} style={{ visibility: 'hidden' }}>
              {formatCharacter(toChar)}
            </span>
          </span>
        );
      })}

      <span className="sr-only">{toText}</span>
    </span>
  );
}

export { RollingText, type RollingTextProps };
