'use client';

import * as React from 'react';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import type { Transition } from 'motion/react';

import {
  useIsInView,
  type UseIsInViewOptions,
} from '@/hooks/use-is-in-view';

function segmentGraphemes(text: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    const seg = new Intl.Segmenter(undefined, {
      granularity: 'grapheme',
    });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

type MorphingTextProps = Omit<HTMLMotionProps<'span'>, 'children'> & {
  characterClassName?: string;
  characterStagger?: number;
  delay?: number;
  loop?: boolean;
  holdDelay?: number;
  wordWrap?: 'character' | 'word';
  text: string | string[];
} & UseIsInViewOptions;

function MorphingText({
  ref,
  text,
  characterClassName,
  characterStagger = 0,
  initial = { opacity: 0, scale: 0.8, filter: 'blur(10px)' },
  animate = { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit = { opacity: 0, scale: 0.8, filter: 'blur(10px)' },
  variants,
  transition = { type: 'spring', stiffness: 125, damping: 25, mass: 0.4 },
  delay = 0,
  inView = false,
  inViewMargin = '0px',
  inViewOnce = true,
  loop = false,
  holdDelay = 2500,
  wordWrap = 'character',
  ...props
}: MorphingTextProps) {
  const { ref: localRef, isInView } = useIsInView(
    ref as React.Ref<HTMLElement>,
    {
      inView,
      inViewOnce,
      inViewMargin,
    },
  );

  const uniqueId = React.useId();

  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [started, setStarted] = React.useState(false);

  const currentText = React.useMemo(() => {
    if (Array.isArray(text)) {
      return text[currentIndex];
    }
    return text;
  }, [text, currentIndex]);

  const chars = React.useMemo(() => {
    const graphemes = segmentGraphemes(currentText);
    const counts = new Map<string, number>();
    return graphemes.map((raw, index) => {
      const key = raw.normalize('NFC');
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return {
        raw,
        index,
        layoutId: `${uniqueId}-${key}-${n}`,
        label: key === ' ' ? '\u00A0' : key,
      };
    });
  }, [currentText, uniqueId]);

  const wordChunks = React.useMemo(() => {
    if (wordWrap !== 'word') return null;

    const chunks: Array<
      | { type: 'word'; chars: typeof chars }
      | { type: 'space'; layoutId: string; value: string }
    > = [];
    let currentWord: typeof chars = [];

    const pushWord = () => {
      if (currentWord.length > 0) {
        chunks.push({ type: 'word', chars: currentWord });
        currentWord = [];
      }
    };

    chars.forEach((char) => {
      if (/\s/u.test(char.raw)) {
        pushWord();
        chunks.push({ type: 'space', layoutId: char.layoutId, value: char.raw });
        return;
      }
      currentWord.push(char);
    });

    pushWord();
    return chunks;
  }, [chars, wordWrap]);

  React.useEffect(() => {
    if (isInView) {
      const timeoutId = setTimeout(() => {
        setStarted(true);
      }, delay);
      return () => clearTimeout(timeoutId);
    }
  }, [isInView, delay]);

  React.useEffect(() => {
    if (!started || !Array.isArray(text)) return;

    let currentIndex = 0;

    const interval = setInterval(() => {
      currentIndex++;
      if (currentIndex >= text.length) {
        if (!loop) {
          clearInterval(interval);
          return;
        } else {
          currentIndex = 0;
        }
      }
      setCurrentIndex(currentIndex);
    }, holdDelay);

    return () => clearInterval(interval);
  }, [started, loop, text, holdDelay]);

  return (
    <motion.span ref={localRef} aria-label={currentText} {...props}>
      <AnimatePresence mode="popLayout" initial={false}>
        {(() => {
          const baseTransition = transition as Transition;
          const baseDelay =
            typeof baseTransition === 'object' &&
            baseTransition !== null &&
            'delay' in baseTransition &&
            typeof baseTransition.delay === 'number'
              ? baseTransition.delay
              : 0;

          const getCharacterTransition = (index: number) =>
            characterStagger > 0
              ? {
                  ...(typeof baseTransition === 'object' && baseTransition !== null
                    ? baseTransition
                    : {}),
                  delay: baseDelay + index * characterStagger,
                }
              : transition;

          const renderCharacter = (char: (typeof chars)[number]) => (
            <motion.span
              key={char.layoutId}
              layoutId={char.layoutId}
              className={characterClassName}
              style={{ display: 'inline-block' }}
              aria-hidden="true"
              initial={initial}
              animate={animate}
              exit={exit}
              variants={variants}
              transition={getCharacterTransition(char.index)}
            >
              {char.label}
            </motion.span>
          );

          if (wordWrap !== 'word' || !wordChunks) {
            return chars.map((char) => renderCharacter(char));
          }

          return wordChunks.map((chunk, chunkIndex) => {
            if (chunk.type === 'space') {
              return (
                <span
                  key={`${chunk.layoutId}-${chunkIndex}`}
                  aria-hidden="true"
                  style={{ whiteSpace: 'pre' }}
                >
                  {chunk.value}
                </span>
              );
            }

            return (
              <span
                key={`${chunk.chars[0]?.layoutId ?? chunkIndex}-word`}
                className="inline-block whitespace-nowrap"
                aria-hidden="true"
              >
                {chunk.chars.map((char) => renderCharacter(char))}
              </span>
            );
          });
        })()}
      </AnimatePresence>
    </motion.span>
  );
}

export { MorphingText, type MorphingTextProps };
