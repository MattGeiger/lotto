'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion, type HTMLMotionProps, type Transition } from 'motion/react';

import { cn } from '@/lib/utils';

const DEFAULT_HIGHLIGHT_CLASS =
  "absolute inset-0 z-0 rounded-[calc(var(--radius)-6px)] border border-border/40 bg-background/80 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-background/55 after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-linear-to-b after:from-background/65 after:to-background/25 after:content-['']";

const DEFAULT_HIGHLIGHT_TRANSITION: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 25,
};

const DEFAULT_CONTENTS_TRANSITION: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  bounce: 0,
  restDelta: 0.01,
};

const DEFAULT_CONTENT_TRANSITION: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 25,
};

type TabsContextValue = {
  activeValue?: string;
  highlightLayoutId: string;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

type TabsHighlightContextValue = {
  className: string;
  transition: Transition;
};

const TabsHighlightContext = React.createContext<TabsHighlightContextValue>({
  className: DEFAULT_HIGHLIGHT_CLASS,
  transition: DEFAULT_HIGHLIGHT_TRANSITION,
});

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('Animate tabs components must be used within <Tabs>.');
  }
  return context;
}

function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const isControlled = value !== undefined;
  const activeValue = isControlled ? value : uncontrolledValue;
  const highlightLayoutId = React.useId();

  const handleValueChange = React.useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [isControlled, onValueChange],
  );

  return (
    <TabsContext.Provider value={{ activeValue, highlightLayoutId }}>
      <TabsPrimitive.Root
        value={isControlled ? value : undefined}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        {...props}
      >
        {children}
      </TabsPrimitive.Root>
    </TabsContext.Provider>
  );
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'relative inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    whileTap?: HTMLMotionProps<'button'>['whileTap'];
  }
>(({ className, whileTap, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    asChild
    {...props}
  >
    <motion.button
      whileTap={whileTap ?? { scale: 0.95 }}
      className={cn(
        'relative z-10 inline-flex min-w-[100px] items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
        className,
      )}
    >
      {children}
    </motion.button>
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

type TabsHighlightProps = React.PropsWithChildren<{
  className?: string;
  transition?: Transition;
}>;

function TabsHighlight({
  children,
  className,
  transition = DEFAULT_HIGHLIGHT_TRANSITION,
}: TabsHighlightProps) {
  return (
    <TabsHighlightContext.Provider
      value={{ className: cn(DEFAULT_HIGHLIGHT_CLASS, className), transition }}
    >
      {children}
    </TabsHighlightContext.Provider>
  );
}

type TabsHighlightItemProps = React.ComponentPropsWithoutRef<'div'> & {
  value: string;
};

const TabsHighlightItem = React.forwardRef<HTMLDivElement, TabsHighlightItemProps>(
  ({ value, className, children, ...props }, ref) => {
    const { activeValue, highlightLayoutId } = useTabsContext();
    const { className: highlightClassName, transition } =
      React.useContext(TabsHighlightContext);
    const isActive = activeValue === value;

    return (
      <div
        ref={ref}
        className={cn('relative flex min-w-0 flex-1 items-stretch', className)}
        {...props}
      >
        {isActive ? (
          <motion.div
            layoutId={highlightLayoutId}
            className={cn('pointer-events-none', highlightClassName)}
            transition={transition}
          />
        ) : null}
        <div className="relative z-10 flex min-w-0 flex-1">{children}</div>
      </div>
    );
  },
);
TabsHighlightItem.displayName = 'TabsHighlightItem';

type TabsContentsProps = Omit<HTMLMotionProps<'div'>, 'children'> & {
  children?: React.ReactNode;
  transition?: Transition;
};

function TabsContents({
  className,
  transition = DEFAULT_CONTENTS_TRANSITION,
  children,
  ...props
}: TabsContentsProps) {
  const { activeValue } = useTabsContext();
  const childrenArray = React.Children.toArray(children);
  const activeIndex = childrenArray.findIndex(
    (child): child is React.ReactElement<{ value?: string }> =>
      React.isValidElement(child) &&
      typeof child.props === 'object' &&
      child.props !== null &&
      'value' in child.props &&
      child.props.value === activeValue,
  );

  const slideIndex = activeIndex >= 0 ? activeIndex : 0;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const [height, setHeight] = React.useState(0);
  const roRef = React.useRef<ResizeObserver | null>(null);

  const measure = React.useCallback((index: number) => {
    const pane = itemRefs.current[index];
    const container = containerRef.current;
    if (!pane || !container) return 0;

    const base = pane.getBoundingClientRect().height || 0;

    const cs = getComputedStyle(container);
    const isBorderBox = cs.boxSizing === 'border-box';
    const paddingY =
      (parseFloat(cs.paddingTop || '0') || 0) +
      (parseFloat(cs.paddingBottom || '0') || 0);
    const borderY =
      (parseFloat(cs.borderTopWidth || '0') || 0) +
      (parseFloat(cs.borderBottomWidth || '0') || 0);

    let total = base + (isBorderBox ? paddingY + borderY : 0);

    const dpr =
      typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    total = Math.ceil(total * dpr) / dpr;

    return total;
  }, []);

  React.useEffect(() => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }

    if (activeIndex < 0) return;

    const pane = itemRefs.current[activeIndex];
    const container = containerRef.current;
    if (!pane || !container) return;

    setHeight(measure(activeIndex));

    const ro = new ResizeObserver(() => {
      const next = measure(activeIndex);
      requestAnimationFrame(() => setHeight(next));
    });

    ro.observe(pane);
    ro.observe(container);

    roRef.current = ro;
    return () => {
      ro.disconnect();
      roRef.current = null;
    };
  }, [activeIndex, childrenArray.length, measure]);

  React.useLayoutEffect(() => {
    if (height === 0 && activeIndex >= 0) {
      const next = measure(activeIndex);
      if (next !== 0) setHeight(next);
    }
  }, [activeIndex, height, measure]);

  return (
    <motion.div
      ref={containerRef}
      className={cn('relative mt-4 overflow-hidden', className)}
      animate={{ height }}
      transition={transition}
      {...props}
    >
      <motion.div
        className="flex -mx-2"
        animate={{ x: `${slideIndex * -100}%` }}
        transition={transition}
      >
        {childrenArray.map((child, index) => (
          <div
            key={index}
            ref={(element) => {
              itemRefs.current[index] = element;
            }}
            className="h-full w-full shrink-0 px-2"
          >
            {child}
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

const TabsContent = React.forwardRef<
  HTMLDivElement,
  HTMLMotionProps<'div'> & {
    value: string;
    transition?: Transition;
  }
>(({ className, value, children, transition = DEFAULT_CONTENT_TRANSITION, ...props }, ref) => {
  const { activeValue } = useTabsContext();
  const isActive = value === activeValue;

  return (
    <motion.div
      ref={ref}
      role="tabpanel"
      data-slot="tabs-content"
      data-state={isActive ? 'active' : 'inactive'}
      inert={!isActive}
      className={cn('overflow-hidden', className)}
      initial={{ filter: 'blur(0px)' }}
      animate={{ filter: isActive ? 'blur(0px)' : 'blur(4px)' }}
      exit={{ filter: 'blur(0px)' }}
      {...props}
      transition={transition}
    >
      {children}
    </motion.div>
  );
});
TabsContent.displayName = 'TabsContent';

export {
  Tabs,
  TabsContent,
  TabsContents,
  TabsHighlight,
  TabsHighlightItem,
  TabsList,
  TabsTrigger,
};
