/** Which of the three hypotheses to draw. "circles" is the default until one is chosen. */
export type Variant = 'seeds' | 'circles' | 'swirl';
/** The mark. Below 96 px it switches to the small cut by itself. */
export interface MarkProps { variant?: Variant; size?: number; ink?: string; small?: boolean; label?: string }
/** Live switch between the three marks, with a Sweep button that cycles them. Pass children(variant) to sweep any component. */
export interface MarkSweepProps { initial?: Variant; size?: number; ink?: string; auto?: boolean; interval?: number; onChange?: (v: Variant) => void; children?: (v: Variant) => any; stageWidth?: number; stageHeight?: number }
/** “we unfold” with OPEN INTELLIGENCE below. */
export interface WordmarkProps { size?: number; tag?: boolean; align?: 'start' | 'center'; color?: string; tagColor?: string }
/** Mark plus wordmark, side by side or stacked. */
export interface LockupProps { variant?: Variant; layout?: 'horizontal' | 'stacked'; size?: number; ink?: string }
/** The Open Intelligence pill for READMEs, sites, decks and footers. */
export interface BadgeProps { variant?: Variant; width?: number; ground?: string; color?: string; ink?: string }
/** The round Open Intelligence seal. */
export interface StampProps { variant?: Variant; size?: number; ground?: string; color?: string; subColor?: string; ink?: string }
