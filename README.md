# best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Fpeazy/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Fpeazy/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Mochi's Lantern Garden — a cute 2D canvas tower defense, now at night. A chubby orange cat, Mochi, defends a paper-lantern garden from shadow bugs under a deep indigo sky. Place cat towers on the garden plots, earn coins for every bug swatted, and survive all 10 waves — including the three-phase Shadow Moth boss, who arrives after a 5-second BOSS INCOMING warning. Towers standing in a lantern's glow fight up to 50% better, and the garden's light dims as the lantern loses lives.

Six cat towers, each with its own look and level-3 final form: Mochi the hero swatter, Yarnball Kitten, Fish Tosser, Sleepy Guard, Star Gazer and Frosty Kitten. The cats are cute but somewhat 3D — clay-like volumes with a top light, a bottom shade, a drop shadow, a separate head volume and forward paws, all in canvas 2D. The garden itself is a real defended night garden: a winding lane edged with stones and a dashed centre line, brown soil plots that glow gold when they stand in lantern light, lantern posts with visible light pools, a moonflower pond, fireflies, flowers and stone cat statues. Three difficulties (Easy, Normal, Hard), a twist (mutator) on every wave from wave 6, upgradeable lantern posts, and after the win the endless Long Night — a Moth Queen every fifth night, for as long as the cats can hold. Every fifth wave the Lantern Festival flares: all the lanterns blaze at once, fireworks rain across the garden, and the Shadow Moth boss — crowned, rim-lit, twice the size of an ordinary bug — answers with a roar of light. Chained kills build a Starfall Combo — five in a row and a star crashes down on the toughest bug on the field. Towers always focus the boss first, so every beam converges on the crown. Three active abilities (Q Flare Burst, E Lantern Surge, R Purr Wave) with cooldowns, per-tower targeting modes (First, Strongest, Weakest, Closest, Last — T cycles), a next-wave preview in the HUD, and an early-call bonus for starting a wave before the build timer runs out.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. Click to start, pick a difficulty, click a shop card and a plot to build, click Start Wave, and click a tower to upgrade or sell it — or click a lantern post to raise its glow. Space starts and restarts, P pauses, F toggles 2x speed, M mutes, 1-6 pick a tower, L enters the Long Night after a win.

---

<sub>Entered on [make.fun](https://make.fun/?ref=afc5cnfr&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
