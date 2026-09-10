import type { Rng } from './rng'

/**
 * Template commentary, deterministic and context-aware. A Commentator is
 * created per match: it never repeats a variant of a pool until every variant
 * of that pool has been used (then the pool resets), and it prefers variants
 * whose context tags match the event. Selection consumes exactly one rng draw
 * per line, keeping simulations reproducible.
 */

export type CommentaryTag =
  | 'equalizer'
  | 'goAhead'
  | 'consolation'
  | 'comeback'
  | 'lateDrama'
  | 'underdog'
  | 'star'
  | 'outOfPosition'
  | 'pressure'
  | 'assisted'
  | 'counter'
  | 'header'
  | 'setPiece'
  | 'longRange'
  | 'oneOnOne'

export interface CommentaryContext {
  player?: string
  /** The creator of the chance, when a pass or cross set it up. */
  assist?: string
  team?: string
  opponent?: string
  /** Chance quality, rendered as e.g. "0.31". */
  xg?: number
  /** Conversion odds in percent, rendered as e.g. "78". */
  odds?: number
  /** Score after the event, from the involved team's perspective ("2–1"). */
  score?: string
  tags?: CommentaryTag[]
}

interface Variant {
  text: string
  requires?: CommentaryTag[]
}

const t = (text: string, ...requires: CommentaryTag[]): Variant =>
  requires.length > 0 ? { text, requires } : { text }

const POOLS = {
  kickoff: [
    t('The whistle goes under the floodlights — we are underway.'),
    t('A wall of noise as {team} get us started.'),
    t('Kick-off. Ninety minutes to rewrite history.'),
    t('The stadium rises as one — this knockout tie is live.'),
    t('First touch for {team}, and the night begins.'),
    t('Flags, flares and a deafening roar: we are off.'),
    t('The referee checks his watch, and away we go.'),
    t('Months of waiting come down to this. Kick-off!'),
  ],
  goal: [
    // Generic finishes.
    t('{player} rises highest at the far post… GOAL for {team}!'),
    t('GOAL! {player} buries it — {team} erupt!'),
    t('{player} finds the bottom corner. Cool as you like for {team}.'),
    t('It falls to {player} in the box… and it is IN! {team} strike!'),
    t('A thunderbolt from {player}! The keeper never moved.'),
    t('{player} arrives on cue and sweeps it home — a chance worth {xg} xG, taken like a training drill.'),
    t('Scenes! {player} turns a {xg}-xG half-chance into a goal from nothing.'),
    t('{team} carve them open and {player} applies the finish. {score}.'),
    // Score-state aware.
    t('{player} LEVELS IT! {score} — this tie has flipped on its head!', 'equalizer'),
    t('All square again! {player} drags {team} back to {score}.', 'equalizer'),
    t('The equalizer arrives — {player} with ice in his veins. {score}.', 'equalizer'),
    t('{team} turn it around?! {player} makes it {score} — they lead!', 'goAhead'),
    t('{player} puts {team} in front! {score}, and the bench empties in celebration!', 'goAhead'),
    t('Advantage {team}! {player} strikes and it is {score}.', 'goAhead'),
    t('{player} pulls one back — {score}, but the mountain is still steep.', 'consolation'),
    t('A lifeline for {team}: {player} makes it {score}.', 'consolation'),
    t('THE COMEBACK IS ON — {player} completes the recovery from two down! {score}!', 'comeback'),
    t('From dead and buried to {score} — {player} caps an astonishing {team} fightback!', 'comeback'),
    // Timing and narrative.
    t("{minute}' and {player} scores NOW?! Late, late drama for {team}!", 'lateDrama'),
    t('The clock shows {minute} and {player} chooses this moment. Bedlam.', 'lateDrama'),
    t('Heartbreak or history — {player} scores in the dying minutes! {score}!', 'lateDrama'),
    t('The upset is brewing! Unfancied {team} lead through {player}!', 'underdog'),
    t('Nobody gave {team} a prayer — tell that to {player}! {score}!', 'underdog'),
    t('David swings, Goliath staggers: {player} scores for {team}!', 'underdog'),
    t('World class. {player} does what the very best do — {team} celebrate.', 'star'),
    t('That is why he is rated among the elite: {player}, unstoppable.', 'star'),
    t('Superstars settle knockout ties. {player} just proved it for {team}.', 'star'),
    t('Playing out of position and he scores anyway — {player}, remarkable.', 'outOfPosition'),
    t('The makeshift man delivers! {player}, in an unfamiliar role, scores for {team}!', 'outOfPosition'),
    // How the chance was made.
    t('{assist} picks the pass and {player} does the rest — GOAL for {team}!', 'assisted'),
    t('Slipped in by {assist}, finished by {player}. {score}.', 'assisted'),
    t('{assist} with the vision, {player} with the finish — {team} score!', 'assisted'),
    t('{player} meets the {assist} delivery with a thumping header! GOAL!', 'header', 'assisted'),
    t('Up goes {player} — a towering header from the {assist} cross, and it is in!', 'header', 'assisted'),
    t('{player} glances the header home. {team} lead the way in the air.', 'header'),
    t('On the break! {player} finishes a lightning counter for {team}!', 'counter'),
    t('Turnover, three passes, GOAL — {player} punishes them on the counter.', 'counter'),
    t('{assist} launches the break and {player} finishes it. Devastating speed from {team}.', 'counter', 'assisted'),
    t('From the set piece! {player} converts and {team} celebrate a training-ground goal.', 'setPiece'),
    t('A dead-ball delivery, a flick, and {player} turns it in! {score}.', 'setPiece'),
    t('FROM DISTANCE! {player} lets fly from way out and it screams in!', 'longRange'),
    t('{player} tries it from thirty yards… and it FLIES in! Unbelievable!', 'longRange'),
    t('One on one, and {player} stays calm — slotted past the keeper. {score}.', 'oneOnOne'),
    t('Through on goal, {player} rounds the keeper and rolls it in. {team} strike!', 'oneOnOne'),
  ],
  'shot-saved': [
    t('{player} forces a sprawling save from the {opponent} keeper.'),
    t('Fierce drive by {player} — beaten away!'),
    t('{player} tries his luck; the goalkeeper stands tall.'),
    t('Great hands! {player} is denied from close range.'),
    t('A {xg}-xG chance for {player} — smothered at the near post.'),
    t('{player} arrows one goalwards; palmed over.'),
    t('The keeper reads it! {player} sees his effort clawed aside.'),
    t('{player} shoots low and hard — pushed around the post.'),
    t('How has that stayed out?! {player} denied by a reflex save.'),
    t('{player} tests the gloves from distance; held at the second attempt.'),
    t('Elite technique, elite save — {player} thwarted this time.', 'star'),
    t("Out of position but not out of ideas — {player}'s effort is kept out.", 'outOfPosition'),
    t('{player} gets his head to the {assist} cross — straight at the keeper.', 'header', 'assisted'),
    t('{player} rises to meet it, but heads straight at the keeper.', 'header'),
    t('The counter ends with {player} shooting — and the keeper standing tall.', 'counter'),
    t('From range, {player} — a comfortable catch.', 'longRange'),
    t('One on one and {player} cannot beat him! A huge save.', 'oneOnOne'),
    t('The corner is met by {player}, and tipped over!', 'setPiece'),
  ],
  'shot-blocked': [
    t('{player} shoots — blocked! Bodies on the line for {opponent}.'),
    t('A brave block denies {player}.'),
    t('{player} pulls the trigger, but it cannons off a defender.'),
    t('Charged down! {player} had the sight of goal but not the space.'),
    t('{player} tries to pick his spot; a sliding block gets in the way.'),
    t('Deflected wide off a defender — {player} will have to try again.'),
    t('{opponent} throw themselves in front of it. {player} denied.'),
    t('Blocked at source — {player} hits a wall of legs.'),
    t('{player} shoots from distance — straight into a defender.', 'longRange'),
    t('The header from {player} is cleared off the line!', 'header'),
  ],
  'shot-miss': [
    t('{player} drags it wide of the near post.'),
    t('Over the bar! {player} leans back at the vital moment.'),
    t('{player} snatches at it — a yard wide.'),
    t('A half-chance for {player} fizzes across the face of goal.'),
    t('{player} slices it into the stands. Groans all around.'),
    t('Daylight between ball and post — {player} narrowly off target.'),
    t('{player} curls one… just past the angle!'),
    t('The gap was there but {player} could not thread it.'),
    t('A {xg}-xG opening goes begging — {player} will want that again.'),
    t('{player} skies it from a promising position.'),
    t('The superstar is human after all — {player} misses the target.', 'star'),
    t('Asked to play a strange role, {player} shoots wide of the mark.', 'outOfPosition'),
    t('{player} heads the {assist} cross over the bar.', 'header', 'assisted'),
    t('{player} gets up well but heads it over.', 'header'),
    t('The break is on… and {player} drags it wide! Wasted.', 'counter'),
    t('{player} tries his luck from way out — into the stands.', 'longRange'),
    t('Clean through, and {player} pulls it wide of the far post! How?!', 'oneOnOne'),
    t('The delivery finds {player} — headed wide.', 'setPiece'),
  ],
  corner: [
    t('Corner to {team}. {player} trots over to take it.'),
    t('{team} win a corner; the big men come forward.'),
    t('Out for a corner — {player} will swing it in.'),
    t('A set piece for {team}: the box fills up.'),
    t('Corner. {player} shapes to whip it toward the near post.'),
    t('{team} keep the pressure on with a corner.'),
    t('Deflected behind — another corner for {team}.'),
    t('Flag kick to {team}. Everyone up.'),
  ],
  penalty: [
    t('PENALTY to {team}! {player} brings down {opponent} in the box!'),
    t('The referee points to the spot! {player} clatters into {opponent} — penalty, {team}.'),
    t('Penalty! {opponent} is felled by {player} and the whistle goes immediately.'),
    t('{player} gets it all wrong: a foul on {opponent}, and {team} have a penalty.'),
    t('Spot kick! {opponent} was through, and {player} took him out.'),
    t('A rash challenge from {player} on {opponent}, and it is a penalty to {team}.'),
  ],
  'yellow-card': [
    t('{player} goes into the book after a cynical foul.'),
    t('Yellow card. {player} chops down the counter-attack.'),
    t('The referee has seen enough — {player} is cautioned.'),
    t('{player} arrives late and pays for it: booked.'),
    t('A tactical foul from {player}; the yellow follows.'),
    t('{player} protests, but the caution stands.'),
    t('Mistimed lunge by {player} — into the notebook he goes.'),
    t('That is a nervous foul from {player}, and a nervous booking.'),
  ],
  'red-card': [
    t('RED CARD! {player} is off — {team} are down to ten!'),
    t('Straight red for {player}. A rush of blood, and {team} must suffer for it.'),
    t('He is off! {player} sees red and the tie turns on its head.'),
    t('Disaster for {team}: {player} is given his marching orders.'),
    t('No arguments — {player} walks, and {team} reorganize in shock.'),
    t('The referee reaches for the back pocket. {player}, dismissed.'),
    t('A moment of madness from {player}, and {team} are a man light.'),
    t('{player} trudges off. Ten men, and a mountain to climb for {team}.'),
  ],
  momentum: [
    t('{team} are turning the screw — wave after wave now.'),
    t('The tide shifts. {team} suddenly look the likelier side.'),
    t('You can feel it in the stands: momentum belongs to {team}.'),
    t('{team} have found another gear here.'),
    t('Everything is funnelling through {team} at the moment.'),
    t('The crowd senses it — {team} are on top.'),
    t('A spell of sustained pressure from {team}.'),
    t('{team} pin their opponents back; the siege begins.'),
  ],
  'sub-window': [
    t('The benches stir — a substitution window opens.'),
    t('Both coaches are deep in conversation. Changes may be coming.'),
    t('Fresh legs warming up on both touchlines.'),
    t('The fourth official readies the board.'),
    t('Tactical wheels turning — expect changes soon.'),
    t('A pause in play, and the dugouts spring to life.'),
    t('Numbers go up on the board as the window opens.'),
    t('Managers trade glances with their benches. Decision time.'),
  ],
  'extra-time': [
    t('Ninety minutes cannot separate them — thirty more to find a winner.'),
    t('Extra time! Tired legs, frayed nerves, and everything still to play for.'),
    t('Level at the whistle. We go again: extra time under the floodlights.'),
    t('Players down stretching cramp — and thirty more minutes to survive.'),
    t('The managers gather their circles. Extra time it is.'),
    t('No separation after ninety. This knockout tie demands more.'),
    t('Deep breaths all around — we head into added thirty.'),
    t('The fourth official signals it: extra time.'),
  ],
  penalties: [
    t('Still level after 120 minutes. It comes down to penalties.'),
    t('Nothing between them all night — a shootout will decide who goes through.'),
    t('The long walk from the halfway line awaits. Penalties!'),
    t('Keepers stretch, takers stare at the turf: shootout time.'),
    t('One hundred and twenty minutes settle nothing. Twelve yards will.'),
    t('The cruellest lottery in football is upon us.'),
    t('Team huddles break; the referee points to the spot. Penalties.'),
    t('History books open to a fresh page: a World Cup shootout.'),
  ],
  'full-time': [
    t('The final whistle blows. It is all over.'),
    t('Full time. The players sink to the turf.'),
    t('There goes the whistle — the story of this one is written.'),
    t('It is finished. Handshakes, embraces, and a few tears.'),
    t('The referee calls time on a compelling contest.'),
    t('Full time, and the noise tells you exactly what it meant.'),
    t('Done. One team marches on in their imagination — the ledger is final.'),
    t('That is that. The numbers are in the book.'),
  ],
  'pen-scored': [
    t('{player} sends the keeper the wrong way. Emphatic.'),
    t('Cool as you like — {player} rolls it in.'),
    t('{player} lashes it high into the net. No chance.'),
    t('Stutter step, calm finish: {player} converts.'),
    t('{player} goes with power — {odds}% odds and he makes them count.'),
    t('The net ripples. {player} does his job from twelve yards.'),
    t('Textbook penalty from {player}: corner picked, keeper beaten.'),
    t('{player} converts with the confidence of a man who never doubted.'),
    t('Everything on this kick — and {player} does not blink. Scored!', 'pressure'),
    t('Must-score, and {player} DELIVERS under maximum pressure!', 'pressure'),
    t('The weight of the shootout on his shoulders, and {player} buries it.', 'pressure'),
    t('Ice. Pure ice. {player} keeps his side alive.', 'pressure'),
  ],
  'pen-saved': [
    t('SAVED! The keeper guesses right and keeps out {player}!'),
    t('Stopped! {player} strikes it well but the keeper is equal to it.'),
    t('A full-stretch save denies {player}!'),
    t('The keeper wins the duel — {player} turns away in agony.'),
    t('{player} telegraphs it, and the keeper says no.'),
    t('Big glove on it! {player} is denied from the spot.'),
    t('The save that could decide it — {player} is stopped!', 'pressure'),
    t('Needing to score, {player} is DENIED — the shootout tilts!', 'pressure'),
    t('The keeper becomes the hero: {player}, saved, and it may be all over.', 'pressure'),
  ],
  'pen-missed': [
    t('Wide! {player} misses the target entirely!'),
    t('Off the woodwork and away — {player} cannot believe it!'),
    t('{player} blazes it over. A dreadful penalty.'),
    t('Dragged past the post — {player} hides his face.'),
    t('The pressure shows: {player} misses everything.'),
    t('No save needed — {player} puts it into the crowd.'),
    t('Everything riding on it, and {player} sends it OVER. Devastating.', 'pressure'),
    t('The must-score moment, and {player} misses! That could be the shootout.', 'pressure'),
    t('Legs of stone at the decisive moment — {player} misses wide.', 'pressure'),
  ],
} as const

export type CommentaryType = keyof typeof POOLS

export interface Commentator {
  line: (type: CommentaryType, ctx?: CommentaryContext) => string
}

function fill(template: string, ctx: CommentaryContext, minute?: number): string {
  return template
    .replace(/\{player\}/g, ctx.player ?? 'the forward')
    .replace(/\{assist\}/g, ctx.assist ?? 'a team-mate')
    .replace(/\{team\}/g, ctx.team ?? 'the home side')
    .replace(/\{opponent\}/g, ctx.opponent ?? 'opposition')
    .replace(/\{xg\}/g, ctx.xg !== undefined ? ctx.xg.toFixed(2) : 'a sniff of')
    .replace(/\{odds\}/g, ctx.odds !== undefined ? String(Math.round(ctx.odds * 100)) : 'even')
    .replace(/\{score\}/g, ctx.score ?? 'level terms')
    .replace(/\{minute\}/g, minute !== undefined ? String(minute) : 'late on')
}

/**
 * Per-match commentator. Variant choice: prefer unused variants whose tags
 * are satisfied by the event's context; otherwise unused generic variants;
 * a pool only resets once fully exhausted. One rng draw per line.
 */
export function createCommentator(rng: Rng): Commentator & { lineAt: (type: CommentaryType, minute: number, ctx?: CommentaryContext) => string } {
  const used = new Map<CommentaryType, Set<number>>()

  const pick = (type: CommentaryType, ctx: CommentaryContext, minute?: number): string => {
    const pool = POOLS[type] as readonly Variant[]
    let usedSet = used.get(type)
    if (!usedSet) {
      usedSet = new Set()
      used.set(type, usedSet)
    }

    const tags = new Set(ctx.tags ?? [])
    // A variant whose required tags aren't ALL present is never eligible —
    // an ordinary shot must not borrow an "out of position" line.
    const allowed = pool
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => !v.requires || v.requires.every((r) => tags.has(r)))

    const unused = (entries: typeof allowed) => entries.filter(({ i }) => !usedSet!.has(i))
    const choose = () => {
      const tagged = unused(allowed.filter(({ v }) => (v.requires?.length ?? 0) > 0))
      if (tagged.length > 0) return tagged
      return unused(allowed.filter(({ v }) => !v.requires))
    }

    let candidates = choose()
    if (candidates.length === 0) {
      // Every allowed variant used: reset this pool and go again.
      usedSet.clear()
      candidates = choose()
    }

    const chosen = candidates[Math.floor(rng.next() * candidates.length)]
    usedSet.add(chosen.i)
    return fill(chosen.v.text, ctx, minute)
  }

  return {
    line: (type, ctx = {}) => pick(type, ctx),
    lineAt: (type, minute, ctx = {}) => pick(type, ctx, minute),
  }
}

/** Pool size for a given context: only variants whose tags are satisfied count. */
export function poolSize(type: CommentaryType, tags: CommentaryTag[] = []): number {
  const active = new Set(tags)
  return (POOLS[type] as readonly Variant[]).filter(
    (v) => !v.requires || v.requires.every((r) => active.has(r)),
  ).length
}

export const ALL_TAGS: CommentaryTag[] = [
  'equalizer',
  'goAhead',
  'consolation',
  'comeback',
  'lateDrama',
  'underdog',
  'star',
  'outOfPosition',
  'pressure',
  'assisted',
  'counter',
  'header',
  'setPiece',
  'longRange',
  'oneOnOne',
]

/** One-shot helper (fresh commentator) for callers outside a match loop. */
export function buildCommentary(rng: Rng, type: CommentaryType, ctx: CommentaryContext = {}): string {
  return createCommentator(rng).line(type, ctx)
}
