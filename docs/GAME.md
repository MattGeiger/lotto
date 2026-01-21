# Snake Game Integration - Technical Design Document

## Overview

This document outlines the design for integrating a classic "Snake" game into the Display Page, where ticket numbers serve as both game elements and functional queue information. The goal is to provide entertainment for clients waiting for their number to be called while maintaining the primary purpose of displaying queue status.

## Project Context

The Display Page (`/src/components/readonly-display.tsx`) currently shows:
- Large "Now Serving" indicator with current ticket number
- Grid display of all ticket numbers in generated order
- Real-time updates via adaptive polling (10s - 120s intervals)
- Multi-language support (8 languages including RTL)
- Dark mode theming
- Responsive layout with ticket status color coding

## Game Concept

### Core Mechanics
- Classic Snake gameplay where the player controls a "snake" that grows by eating "food"
- **Unique Twist**: The snake's body is composed of ticket number elements from the actual queue
- Arrow keys control snake direction (Up, Down, Left, Right)
- Food pellet spawns at random positions on the grid
- Snake grows when eating food, adding the next ticket number to its body
- Game over if snake hits walls or its own body

### Integration Goals
1. **Dual Purpose Display**: Ticket grid serves as both game board and queue information
2. **Non-Intrusive**: Game should not interfere with primary function of displaying queue status
3. **Optional Play**: Users can choose to play or simply watch the queue updates
4. **Visual Clarity**: Game state must be distinguishable from actual queue status

### Alternative Concepts (Under Consideration)

#### **Concept A: Modal Overlay Game**
- Fixed-dimension modal layer renders on top of the Display Page
- "Now Serving" number remains visible in background through semi-transparent overlay
- Game runs in self-contained modal with its own fixed grid
- Players can see queue updates while playing
- **Key Advantage**: Completely decoupled from main display architecture
- **Design Note**: Modal would need strategic positioning/transparency to keep critical info visible

#### **Concept B: Queue-Integrated Snake**
- Snake's head IS the "Now Serving" ticket number
- Snake's body composed of previously "Called" (served) tickets in chronological order
- Player controls where the head moves to "call" the next ticket
- Food pellets could represent upcoming tickets waiting to be called
- **Key Advantage**: Game mechanics directly mirror the queue progression
- **Gameplay Twist**: As real tickets are called, they're added to the snake automatically
- **Design Note**: Creates unique blend where game state reflects actual queue state

## Technical Considerations

### 1. Display Architecture Challenges

#### Current Implementation
- Ticket grid uses `grid-cols-[repeat(auto-fill,minmax(96px,1fr))]` for responsive wrapping
- Grid size changes dynamically based on:
  - Number of tickets in queue
  - Screen dimensions
  - Available space after header/footer
- Individual tickets are 96px minimum width with flexible growth

#### Game Requirements
- Snake games require **fixed, predictable grid dimensions** for movement logic
- Typical Snake grid: 20x20 or similar square/rectangular matrix
- Each cell must have consistent size and position
- Need deterministic adjacency (up/down/left/right neighbors)

#### **CRITICAL CONFLICT**
The current auto-filling responsive grid is fundamentally incompatible with Snake game logic. Solutions:

**Option A: Dual-Mode Display**
- Toggle between "Queue View" (current responsive grid) and "Game View" (fixed game grid)
- Game mode uses fixed-dimension grid overlay (e.g., 24x16 cells)
- Ticket numbers populate game grid in order
- Requires mode switcher button/control

**Option B: Fixed Grid Always**
- Redesign ticket display to always use fixed dimensions
- Calculate grid size based on ticket count (e.g., nearest square/rectangle)
- May waste space or create odd layouts with certain ticket counts
- Breaks current responsive design philosophy

**Option C: Game in Separate Panel**
- Keep current ticket grid as-is
- Add dedicated game area (sidebar or bottom section)
- Game uses ticket numbers but in separate game-specific grid
- Maintains current display integrity

**ORIGINAL RECOMMENDATION**: Option A (Dual-Mode Display) provides best balance of game functionality and display utility.

#### **NEW CONCEPT COMPARISON**

The alternative concepts (Modal Overlay and Queue-Integrated Snake) both address the architecture conflict more elegantly:

**Modal Overlay Game (Concept A)**

*Technical Benefits:*
- ✅ **Zero impact on existing display code** - completely separate component
- ✅ **Fixed grid trivial to implement** - modal controls its own dimensions
- ✅ **No responsive layout conflicts** - modal has independent sizing
- ✅ **Easy to implement** - standard Dialog/Modal component with game inside
- ✅ **"Now Serving" remains visible** - semi-transparent overlay or strategic positioning

*Technical Challenges:*
- ⚠️ **Z-index management** - ensure modal layers correctly
- ⚠️ **Transparency balance** - overlay must not obscure critical info too much
- ⚠️ **Focus management** - modal traps focus but needs to allow seeing background
- ⚠️ **Mobile experience** - full-screen modal on small screens may hide queue entirely

*Implementation Approach:*
```tsx
<ReadOnlyDisplay>
  {/* Existing display */}
  <div className="now-serving">...</div>
  <div className="ticket-grid">...</div>

  {/* New modal overlay */}
  {gameActive && (
    <Dialog open={gameActive} onOpenChange={setGameActive}>
      <DialogContent className="game-modal">
        <SnakeGame fixedGrid={20x15} />
      </DialogContent>
    </Dialog>
  )}
</ReadOnlyDisplay>
```

**Queue-Integrated Snake (Concept B)**

*Technical Benefits:*
- ✅ **Deeply meaningful integration** - game reflects actual queue state
- ✅ **Educational/transparent** - players see queue progression through gameplay
- ✅ **Natural updates** - real ticket calls automatically grow the snake
- ✅ **Unique experience** - no other queue system has this feature
- ✅ **Maintains queue visibility** - game IS the queue display

*Technical Challenges:*
- ⚠️ **Complex state synchronization** - snake must track both game state AND queue state
- ⚠️ **Dual control problem** - player controls + automatic growth from real calls
- ⚠️ **Collision detection complexity** - what happens if real call creates illegal game state?
- ⚠️ **Speed mismatch** - snake moves every 200ms, real tickets called every ~2 minutes
- ⚠️ **Still needs fixed grid** - requires predictable layout for movement

*State Synchronization Scenarios:*
```typescript
// Scenario 1: Real ticket called while player is moving
// Snake body: [#15-head, #14, #13, #12] (currentlyServing = #15)
// Admin calls next ticket (#16)
// Result: Snake grows automatically, head becomes #16
// Challenge: Player didn't "eat" anything, snake just grew

// Scenario 2: Player moves snake, triggers game "call"
// Snake head eats food pellet (which represents next ticket #17)
// Result: Snake grows, AND this triggers actual ticket call in queue system?
// Challenge: Game actions affecting real queue could be problematic

// Scenario 3: Ticket returned or becomes unclaimed
// Snake body includes ticket #13, which gets marked "returned"
// Result: Does that segment change color? Disappear? Nothing?
```

*Possible Implementation Models:*

**Model 1: Passive Integration (Display Only)**
- Snake head reflects current `currentlyServing`
- Snake body reflects `calledNumbers` in chronological order
- Player controls are VISUAL ONLY - don't affect real queue
- Food pellets are decorative - eating them doesn't call real tickets
- **Pro**: Safe, no risk of game affecting real queue
- **Con**: Less interactive, more like watching queue with game overlay

**Model 2: Active Integration (Game Controls Queue)**
- Player movement determines which ticket gets called next
- Eating food pellet triggers actual API call to advance queue
- Snake growth directly reflects queue progression
- **Pro**: Deeply integrated, player is "operating" the queue
- **Con**: Risky - game bugs could disrupt real queue operations
- **Con**: Single-player only - multi-user kiosk would have control conflicts

**Model 3: Hybrid (Game + Automatic Sync)**
- Snake starts with recent called tickets as initial body
- Player plays normal Snake game with independent logic
- When REAL ticket is called (via admin/system), snake grows automatically
- Visual indicator distinguishes "player-earned" vs "system-added" segments
- **Pro**: Best of both worlds
- **Con**: Most complex to implement

**REVISED RECOMMENDATION**:

For **MVP/Phase 1**: **Modal Overlay Game (Concept A)** is strongly recommended because:
1. Fastest to implement (1-2 days vs 1-2 weeks)
2. Zero risk to existing queue functionality
3. Easy to test and iterate
4. Clean separation of concerns
5. "Now Serving" visibility maintained through transparency/positioning

For **Future Enhancement**: **Queue-Integrated Snake (Concept B, Model 1: Passive)** could be added as an alternative game mode:
1. Implement after modal version is proven stable
2. Use passive integration to avoid queue manipulation risks
3. Provides unique "watch the queue" game experience
4. Could be educational for users learning the queue system

### 2. Modal Overlay Design Considerations

Since the **Modal Overlay** approach is recommended for MVP, here are specific implementation details:

#### Modal Positioning & Transparency

**Option A: Centered Semi-Transparent Modal**
```tsx
<DialogContent className="
  fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
  w-[800px] h-[600px]
  bg-background/95 backdrop-blur-sm
  border-2 border-primary
">
  <SnakeGame />
</DialogContent>
```
- **Pros**: Traditional modal UX, clear game boundary
- **Cons**: May still obscure "Now Serving" depending on screen size

**Option B: Corner-Positioned Modal**
```tsx
<DialogContent className="
  fixed bottom-4 right-4
  w-[600px] h-[450px]
  bg-background/98
  shadow-2xl
">
  <SnakeGame />
</DialogContent>
```
- **Pros**: "Now Serving" (typically top-center) stays completely visible
- **Cons**: May conflict with QR code (top-right) or other UI elements

**Option C: Top-Positioned with Cut-Out**
```tsx
<div className="fixed inset-0 pointer-events-none">
  {/* Dimmed overlay with hole for "Now Serving" */}
  <div className="absolute inset-0 bg-black/20"
       style={{clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, 30% 10%, 70% 10%, 70% 20%, 30% 20%)'}}
  />
  {/* Game modal */}
  <DialogContent className="
    absolute top-[25%] left-1/2 -translate-x-1/2
    pointer-events-auto
  ">
    <SnakeGame />
  </DialogContent>
</div>
```
- **Pros**: Guaranteed "Now Serving" visibility with visual emphasis
- **Cons**: Complex CSS, might look unusual

**RECOMMENDED**: Option B (Corner Position) for simplicity and guaranteed visibility.

#### Modal Game Grid Sizing

**Adaptive Grid Dimensions Based on Ticket Count:**
```typescript
function calculateGameGrid(ticketCount: number): {width: number, height: number} {
  // Target: include all tickets in game grid
  const cellCount = ticketCount;

  // Prefer 16:10 aspect ratio (typical display ratio)
  // Find factors closest to 16:10
  const ratio = 1.6;
  const height = Math.ceil(Math.sqrt(cellCount / ratio));
  const width = Math.ceil(cellCount / height);

  return {width, height};
}

// Examples:
// 50 tickets → 10x5 grid (50 cells)
// 100 tickets → 13x8 grid (104 cells, 4 empty)
// 150 tickets → 16x10 grid (160 cells, 10 empty)
```

**Alternatively, Fixed Standard Grid:**
```typescript
const GAME_GRID = {
  width: 20,
  height: 15,
  totalCells: 300
};

// If more than 300 tickets, only use first 300 in game
// If fewer, fill with empty cells
```

#### Modal Content Structure

```tsx
<DialogContent className="game-modal">
  {/* Header */}
  <div className="game-header">
    <h2>{t.gameTitle}</h2>
    <div className="game-stats">
      <span>Score: {score}</span>
      <span>Length: {snake.length}</span>
    </div>
    <button onClick={closeGame}>{t.exitGame}</button>
  </div>

  {/* Game Grid */}
  <div className="game-grid">
    {/* Fixed-dimension grid of cells */}
    {cells.map((cell, idx) => (
      <div
        key={idx}
        className={getCellClass(cell)}
        data-ticket={cell.ticketNumber}
      >
        {cell.ticketNumber}
      </div>
    ))}
  </div>

  {/* Instructions */}
  <div className="game-instructions">
    {t.useArrowKeys}
  </div>

  {/* Background peek - show "Now Serving" through transparency */}
  <div className="now-serving-indicator" aria-live="polite">
    {t.nowServing}: {currentlyServing}
  </div>
</DialogContent>
```

#### Integrating Ticket Numbers into Game

**Approach 1: Tickets as Collectibles**
- Game grid populated with actual ticket numbers
- Snake starts at "Currently Serving" position
- Food spawns on upcoming ticket numbers
- Eating food collects that ticket (visual effect only)
- Snake body shows collected tickets

**Approach 2: Tickets as Background**
- Game grid shows ticket numbers in each cell
- Snake overlays on top of tickets
- Tickets remain visible beneath snake segments
- Players can still track their position in queue while playing

**Approach 3: Hybrid Display**
```tsx
<div className="game-cell">
  {/* Background: ticket number */}
  <span className="ticket-number">{ticketNumber}</span>

  {/* Overlay: game element if present */}
  {isSnakeHead && <div className="snake-head">🐍</div>}
  {isSnakeBody && <div className="snake-body" />}
  {isFood && <div className="food">🍎</div>}
</div>
```

### 3. Real-Time Data Updates

#### Current Polling Behavior
- Display polls `/api/state` every 10-120 seconds based on activity
- State updates can add/remove tickets, change serving status, modify order
- Timestamp comparison detects changes and resets polling interval

#### Game State Challenges

**Problem 1: Grid Mutation During Gameplay**
- User is playing Snake with ticket numbers [1, 2, 3, 4, 5...]
- Poll updates arrives: ticket #3 is now "served" (removed from active queue)
- Snake body includes ticket #3 - should it disappear? Change color? Stay?

**Problem 2: Ticket Count Changes**
- Game starts with 50 tickets (grid sized accordingly)
- 10 new tickets added during play
- Grid needs to accommodate 60 tickets - resize? Overflow?

**Problem 3: Order Changes**
- Ticket order can change if admin modifies `generatedOrder`
- Snake body composed of tickets [5, 12, 8, 23]
- Order changes to move ticket #8 elsewhere in sequence
- Does this affect game state?

#### **Potential Solutions**

**Solution 1: Snapshot Mode**
- Game captures ticket state at start of round
- Ignores updates during active gameplay
- When game ends (win/lose), refresh to current state
- **Pros**: Simple, no mid-game disruption
- **Cons**: Display becomes stale during play

**Solution 2: Non-Intrusive Updates**
- Allow polls to continue
- Update ticket metadata (colors, status) but not positions
- Snake uses ticket numbers as immutable identifiers
- Status changes reflected visually but don't affect game logic
- **Pros**: Display stays current
- **Cons**: Complex state synchronization

**Solution 3: Game Pause on Updates**
- Detect state changes during gameplay
- Automatically pause game and show "Queue Updated" notification
- User can choose to continue with old state or restart with new state
- **Pros**: User stays informed
- **Cons**: Interrupts gameplay frequently if queue is active

**RECOMMENDATION**: Solution 1 (Snapshot Mode) for MVP, with clear indicator that game is using snapshot data.

### 4. Input Handling

#### Current Interactivity
- Display page is designed for **passive viewing** (kiosk/TV display)
- Only interactions: clicking tickets for detail dialog, theme/language switchers
- No continuous input handling or key press listeners

#### Game Requirements
- Arrow key event listeners (`keydown` events)
- Continuous input polling for responsive controls
- Possible touch/swipe support for mobile displays

#### **Technical Considerations**

**Challenge 1: Focus Management**
- Arrow keys only work when game element has focus
- Ticket Detail Dialog can steal focus (currently)
- Need to ensure game container maintains focus during play

**Challenge 2: Keyboard Conflicts**
- Dialog uses `Escape` to close
- Tickets use `Enter`/`Space` to open
- Need to prevent game controls from triggering other actions

**Challenge 3: Device Context**
- Display page often shown on public kiosk or wall-mounted screen
- May not have keyboard/touch input available
- Game needs clear "input method not available" state

#### **Proposed Solutions**
- Add `onKeyDown` listener at game container level with `event.stopPropagation()`
- Auto-focus game container when entering game mode
- Disable ticket clicking during active gameplay
- Add touch gesture support (swipe in 4 directions) as alternative input
- Show clear "No Input Detected" message if no keyboard/touch available

### 5. Visual Design Integration

#### Current Styling System
- Tailwind CSS with custom OKLCH colors
- Status-based gradients: `ticket-serving`, `ticket-served`, `ticket-upcoming`, etc.
- Dark mode with `.dark` class toggling
- Gradient backgrounds and shadow effects

#### Game Visual Needs

**Snake Representation**
- Snake head: needs distinct appearance from body
- Snake body: connected segments showing ticket numbers
- Food pellet: eye-catching, animated indicator
- Game grid: clear cell boundaries

**Status Overlap Challenges**
- Ticket #15 is "currently serving" (yellow gradient) AND in snake body
- Should game status (snake) override queue status (serving)?
- How to show both pieces of information simultaneously?

#### **Design Proposal**

**Game Mode Styling**
```css
.game-mode .ticket-cell {
  /* Base cell styling */
  border: 1px solid oklch(var(--border));
}

.game-mode .snake-head {
  /* Distinct head styling */
  background: linear-gradient(to bottom right, #3b82f6, #8b5cf6);
  border: 2px solid oklch(var(--primary));
  animation: pulse 1s infinite;
}

.game-mode .snake-body {
  /* Body segments show ticket number */
  background: oklch(var(--primary) / 0.7);
  /* Retain subtle status indicator via border color */
  border-left: 3px solid var(--status-color);
}

.game-mode .food-pellet {
  background: radial-gradient(circle, #10b981, #059669);
  animation: glow 1.5s ease-in-out infinite;
}
```

**Status Preservation**
- Game mode adds `data-status` attribute to cells
- Border color or small indicator preserves queue status
- Allows ticket status visibility without interfering with game graphics

### 6. State Management Architecture

#### Current State Structure
```typescript
// From /src/lib/state-types.ts
interface RaffleState {
  generatedOrder: string[];
  calledNumbers: Record<string, number>; // ticketNum -> timestamp
  currentlyServing: string | null;
  returnedTickets: Set<string>;
  unclaimedTickets: Set<string>;
  // ... operating hours, etc.
}
```

#### Game State Requirements
```typescript
interface GameState {
  mode: 'queue-view' | 'game-active' | 'game-paused' | 'game-over';
  snapshotTickets: string[]; // Tickets at game start
  snake: {
    position: Array<{x: number, y: number}>;
    direction: 'up' | 'down' | 'left' | 'right';
    ticketSegments: string[]; // Ticket numbers forming snake body
  };
  food: {x: number, y: number};
  grid: {
    width: number;
    height: number;
  };
  score: number;
  gameSpeed: number; // milliseconds per move
}
```

#### **State Management Questions**

1. **Where to store GameState?**
   - Option A: Local component state (useState)
   - Option B: Context provider for global access
   - Option C: URL parameters for shareability
   - **RECOMMENDATION**: Local component state (useState) for MVP

2. **Game loop implementation?**
   - Option A: `setInterval()` for fixed tick rate
   - Option B: `requestAnimationFrame()` with delta time
   - Option C: Combination: RAF for rendering, interval for game logic
   - **RECOMMENDATION**: Option A (setInterval) for predictable game speed

3. **Persistence?**
   - Should high scores persist across sessions?
   - Should game state survive page refresh?
   - localStorage for high scores table?
   - **RECOMMENDATION**: No persistence for MVP, add later if desired

### 7. Game Logic Implementation

#### Core Algorithms Needed

**1. Grid Mapping**
```typescript
// Map ticket index to grid coordinates
function ticketToGridPos(ticketIndex: number, gridWidth: number): {x: number, y: number} {
  return {
    x: ticketIndex % gridWidth,
    y: Math.floor(ticketIndex / gridWidth)
  };
}

// Map grid position to ticket
function gridPosToTicket(x: number, y: number, gridWidth: number, tickets: string[]): string | null {
  const index = y * gridWidth + x;
  return tickets[index] ?? null;
}
```

**2. Collision Detection**
```typescript
function checkCollision(head: {x, y}, snake: Array<{x, y}>, gridWidth: number, gridHeight: number): boolean {
  // Wall collision
  if (head.x < 0 || head.x >= gridWidth || head.y < 0 || head.y >= gridHeight) {
    return true;
  }

  // Self collision (check if head position matches any body segment)
  return snake.some(segment => segment.x === head.x && segment.y === head.y);
}
```

**3. Food Spawning**
```typescript
function spawnFood(snake: Array<{x, y}>, gridWidth: number, gridHeight: number): {x: number, y: number} {
  let pos: {x: number, y: number};
  do {
    pos = {
      x: Math.floor(Math.random() * gridWidth),
      y: Math.floor(Math.random() * gridHeight)
    };
  } while (snake.some(segment => segment.x === pos.x && segment.y === pos.y));

  return pos;
}
```

**4. Movement Update**
```typescript
function moveSnake(snake: Array<{x, y}>, direction: string, grow: boolean): Array<{x, y}> {
  const head = {...snake[0]};

  // Update head position based on direction
  switch(direction) {
    case 'up': head.y -= 1; break;
    case 'down': head.y += 1; break;
    case 'left': head.x -= 1; break;
    case 'right': head.x += 1; break;
  }

  const newSnake = [head, ...snake];

  // Remove tail unless growing
  if (!grow) {
    newSnake.pop();
  }

  return newSnake;
}
```

### 8. Accessibility Considerations

#### Current Accessibility Features
- ARIA labels on interactive elements
- Keyboard navigation (Tab, Enter, Space)
- Screen reader support with `aria-live` regions
- RTL support for Arabic/Farsi
- Semantic HTML structure

#### Game Accessibility Challenges

**Challenge 1: Screen Reader Compatibility**
- Snake game is highly visual and timing-based
- Screen readers cannot effectively convey real-time game state
- Arrow key navigation conflicts with screen reader shortcuts

**Challenge 2: Keyboard-Only Users**
- Game requires keyboard, but so do screen readers
- Need to detect assistive technology usage

**Challenge 3: Motion Sensitivity**
- Rapid movement and animations may trigger motion sensitivity
- Need option to reduce/disable animations

#### **Accessibility Recommendations**

1. **Skip Game Option**: Prominent "Skip Game" or "View Queue Only" button for users who cannot or choose not to play

2. **Keyboard Trap Prevention**:
   - Clear "Exit Game Mode" button (Escape key)
   - Focus returns to main content when exiting

3. **Reduced Motion Support**:
   ```css
   @media (prefers-reduced-motion: reduce) {
     .game-mode .snake-head,
     .game-mode .food-pellet {
       animation: none;
     }
   }
   ```

4. **ARIA Live Region** for game events:
   ```html
   <div aria-live="polite" aria-atomic="true" class="sr-only">
     Score: {score}. Snake length: {snake.length}.
   </div>
   ```

5. **Alternative Display**: Keep "Now Serving" display visible even during game mode so users who skip game still see critical info

### 9. Performance Considerations

#### Current Performance Profile
- Single component re-render on state updates (every 10-120s)
- Minimal JavaScript execution between polls
- Static ticket grid rendering with CSS transitions

#### Game Performance Requirements
- Game loop running at 100-200ms intervals (5-10 FPS equivalent)
- Re-render on every game tick (snake movement)
- Input event handling with sub-100ms response time

#### **Potential Issues**

**Issue 1: Render Performance with Large Grids**
- 50+ tickets = 50+ DOM elements updating every game tick
- React reconciliation overhead
- CSS animations on moving elements

**Issue 2: Memory Leaks**
- Game interval not cleared properly
- Event listeners not removed on unmount
- Animation frames accumulating

**Issue 3: Mobile Performance**
- Touch event handling overhead
- Smaller screens = more complex layouts
- Battery drain from continuous game loop

#### **Optimization Strategies**

1. **Memoization**:
   ```typescript
   const GameGrid = React.memo(({cells, snake, food}) => {
     // Only re-render if props actually change
   });
   ```

2. **CSS Transforms** over position changes:
   ```css
   .snake-segment {
     transform: translate(var(--x), var(--y));
     /* GPU-accelerated, no layout recalculation */
   }
   ```

3. **Cleanup on unmount**:
   ```typescript
   useEffect(() => {
     const intervalId = setInterval(gameLoop, gameSpeed);
     return () => clearInterval(intervalId);
   }, [gameSpeed]);
   ```

4. **Throttled Input**:
   ```typescript
   const handleKeyPress = useCallback((e: KeyboardEvent) => {
     // Prevent multiple direction changes within single game tick
     if (Date.now() - lastInputTime < gameSpeed) return;
     // ... handle input
   }, [gameSpeed, lastInputTime]);
   ```

5. **Canvas Rendering** (alternative approach):
   - Instead of DOM elements, render game on HTML5 Canvas
   - Single canvas element, no DOM reconciliation
   - Manual drawing of tickets, snake, food
   - Better performance but more complex implementation

### 10. Localization

#### Current Language Support
- 8 languages: English, Chinese (Simplified), Spanish, Russian, Ukrainian, Vietnamese, Farsi, Arabic
- RTL layout support for Arabic/Farsi
- Translation keys in `LanguageContext`

#### Game Text Requirements
- Game UI labels: "Start Game", "Pause", "Game Over", "Score", "High Score"
- Instructions: "Use arrow keys to control the snake"
- Status messages: "Queue Updated - Game Paused"

#### **Translation Needs**
```typescript
// Add to translation keys
const gameTranslations = {
  en: {
    startGame: "Start Game",
    pauseGame: "Pause",
    resumeGame: "Resume",
    exitGame: "Exit Game",
    gameOver: "Game Over!",
    score: "Score",
    instructions: "Use arrow keys to move",
    queueUpdated: "Queue updated - game paused",
    // ...
  },
  zh: { /* Chinese translations */ },
  es: { /* Spanish translations */ },
  // ... etc
};
```

### 11. Implementation Phases

#### **Phase 1: Proof of Concept** (Minimal Viable Game)
- [ ] Create separate `/game` page to prototype game mechanics
- [ ] Implement basic Snake logic with hardcoded grid
- [ ] Test game loop, collision detection, food spawning
- [ ] Validate performance and input handling
- **Goal**: Confirm technical feasibility before integrating with display

#### **Phase 2: Display Integration** (Dual-Mode View)
- [ ] Add "Game Mode" toggle to Display Page
- [ ] Implement snapshot mechanism (freeze ticket state)
- [ ] Create fixed-grid layout for game mode
- [ ] Map tickets to grid positions
- **Goal**: Working game embedded in actual display page

#### **Phase 3: Polish & UX** (User Experience)
- [ ] Add game instructions overlay
- [ ] Implement pause/resume functionality
- [ ] Add visual polish (animations, effects)
- [ ] Create "Game Over" modal with score
- [ ] Add high score tracking (localStorage)
- **Goal**: Polished, intuitive game experience

#### **Phase 4: Advanced Features** (Optional Enhancements)
- [ ] Difficulty levels (speed settings)
- [ ] Power-ups or special ticket effects
- [ ] Touch/swipe controls for mobile
- [ ] Leaderboard (persistent across sessions)
- [ ] Multiple game variants (different modes)
- **Goal**: Extended gameplay and engagement

## Open Questions

1. **Game Activation**:
   - Should game be opt-in (user clicks "Play Game")?
   - Or auto-start after period of inactivity?
   - Or always available but optional?

2. **Score Calculation**:
   - Simple: +1 per food eaten?
   - Ticket-aware: Points based on ticket number value?
   - Bonus for eating tickets in order?

3. **Win Condition**:
   - Fill entire grid (classic Snake)?
   - Reach certain score threshold?
   - Time-based challenge?
   - No win condition (endless mode)?

4. **Ticket Representation**:
   - Show full ticket number in each snake segment?
   - Show just cell color/indicator?
   - Only show number on hover?

5. **Multi-Player Support** (Future):
   - Multiple snakes on same grid?
   - Requires WebSocket for real-time sync
   - Significant architectural change

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Game distracts from queue purpose | High | Make queue info always visible, game clearly optional |
| Performance degrades display | High | Extensive testing, fallback to queue-only mode |
| Input conflicts with accessibility | Medium | Comprehensive keyboard trap prevention, skip option |
| State synchronization bugs | Medium | Thorough testing of snapshot mode, clear update indicators |
| Responsive layout breaks | Medium | Fixed grid for game mode, maintain responsive queue view |
| Polling disrupts gameplay | Low | Snapshot mode isolates game from updates |

## Success Metrics

- **Engagement**: User interaction time increases on display page
- **Functionality**: Queue display remains primary, readable, accurate
- **Performance**: Game maintains 60 FPS, no impact on polling performance
- **Accessibility**: All users can access queue info regardless of game participation
- **Stability**: No crashes, memory leaks, or state corruption

## Next Steps

1. **Review & Approval**: Discuss this document with stakeholders
2. **Design Mockups**: Create visual mockups of dual-mode display
3. **Technical Spike**: Build Phase 1 proof-of-concept
4. **User Testing**: Validate game UX with representative users
5. **Implementation**: Proceed with Phase 2+ based on spike results

---

## Executive Summary

### Preferred Implementation Strategy

Based on technical analysis and the alternative concepts proposed, the recommended implementation path is:

**Phase 1 (MVP): Modal Overlay Game**
- **Implementation**: Fixed-dimension modal layer that renders on top of the Display Page
- **Positioning**: Bottom-right corner (600x450px) to keep "Now Serving" visible
- **Grid**: Adaptive sizing based on ticket count (e.g., 50 tickets → 10x5 grid)
- **Integration**: Tickets populate game grid; snake body shows collected ticket numbers
- **Timeline**: 1-2 days for working prototype
- **Risk**: Low - zero impact on existing display functionality

**Phase 2 (Future Enhancement): Queue-Integrated Snake**
- **Implementation**: Snake head reflects "Currently Serving", body shows called tickets chronologically
- **Mode**: Passive integration - game display only, doesn't control real queue
- **Experience**: Educational and unique - players watch queue progression through gameplay
- **Timeline**: 1-2 weeks after modal version proves stable
- **Risk**: Medium - requires careful state synchronization

### Key Technical Decisions

1. **Modal vs. Full-Screen**: Modal overlay maintains queue visibility ✅
2. **Fixed Grid**: Required for Snake game logic - modal enables this ✅
3. **Snapshot Mode**: Game captures ticket state at start, refreshes on end ✅
4. **Corner Positioning**: Bottom-right placement keeps "Now Serving" visible ✅
5. **Ticket Integration**: Show ticket numbers in grid cells, collected by snake ✅

### Why These Concepts Work Better

Your alternative concepts solve the original architecture conflicts:
- **Modal approach**: Sidesteps responsive grid issues entirely
- **Queue-integrated snake**: Creates meaningful connection between game and waiting experience
- **Visibility maintained**: "Now Serving" stays visible during play
- **Clean separation**: Game code isolated from display logic

The modal overlay (Concept A) provides the fastest path to a working game, while the queue-integrated snake (Concept B) offers a unique future enhancement that no other queue system has.

---

**Document Version**: 2.0
**Last Updated**: 2026-01-19
**Revision**: Added alternative concepts (Modal Overlay & Queue-Integrated Snake)
**Author**: Technical Analysis Based on Codebase Exploration
