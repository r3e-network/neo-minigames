# neo-minigames

Neo MiniGames — app sources, their contracts, and the pipeline that publishes
built bundles to the CDN. Split out of
[neo-miniapps-platform](https://github.com/r3e-network/neo-miniapps-platform),
which now holds only platform code and loads these apps from the CDN at runtime.

## Layout

```
apps/<slug>/            one Vite SPA per app, with its neo-manifest.json
apps/tests/unit/        per-app tests (they reach their app by relative path)
apps/tests/test-utils/  shared vitest setup and SDK mocks
contracts/              per-app Neo N3 contracts + vendored MiniApp.DevPack
scripts/                build-all, CDN publisher, DevPack drift check
```

## Apps (25)

| Slug | Name | Category | Contract |
| --- | --- | --- | --- |
| `aim-master` | Aim Master | games | `MiniAppAimMaster` |
| `arrow-escape` | Garden Arrowworks | games | shared platform contract |
| `bead-workshop` | Bead Workshop | games | shared platform contract |
| `burn-league` | Burn League | games | `MiniAppBurnLeague` |
| `color-clash` | Color Clash | games | `MiniAppColorClash` |
| `curve-arrow` | Curve Arrow | games | `MiniAppCurveArrow` |
| `daily-checkin` | Daily Check-in | games | `MiniAppDailyCheckin` |
| `dice-game` | Dice Game | games | `MiniAppCoinFlip`, `MiniAppCoinFlipV2`, `MiniAppDiceGame`, `MiniAppDiceGameV2` |
| `flappy-dash` | Flappy Dash | games | `MiniAppFlappyDash` |
| `fogplay` | FogPlay | games | shared platform contract |
| `fruit-funnel` | Fruit Funnel | games | shared platform contract |
| `game-2048` | 2048 Rush | games | `MiniAppGame2048` |
| `gas-lucky-pool` | OneGate Vault | games | shared platform contract |
| `gasbox` | GASBOX | games | `MiniAppGasBox`, `MiniAppGasBoxV2` |
| `gomoku` | Gomoku Arena | games | shared platform contract |
| `jump-rush` | Jump Rush | games | `MiniAppJumpRush` |
| `last-survivor` | LastSurvivor | games | `MiniAppLastSurvivor` |
| `merge-kingdom` | Merge Kingdom | games | `MiniAppMergeKingdom` |
| `on-chain-tarot` | On-chain Tarot | games | `MiniAppTarot`, `MiniAppTarotVrf` |
| `pet-potion` | Pet Potion | games | `MiniAppPetPotion` |
| `screw-sort` | Screw Sort | games | shared platform contract |
| `sheep-solitaire` | Sheep Solitaire | games | `MiniAppSheepSolitaire` |
| `snake-bounty` | Snake Bounty | games | `MiniAppSnakeBounty` |
| `sudoku` | Sudoku Arena | games | `MiniAppSudoku` |
| `zhuada-e` | Goose Basket Shuffle | games | shared platform contract |

## Develop

```bash
npm install
npm test
cd apps/<slug> && npx vite
```

Apps import the SDK through the `@shared/*` and `@framework/*` aliases, which
resolve to [`neo-miniapp-sdk`](https://github.com/r3e-network/neo-miniapp-sdk)
in `node_modules`. Installing needs an `.npmrc` pointed at GitHub Packages for
the `@r3e-network` scope (one is committed here).

## Publish to the CDN

```bash
npm run build
npm run publish:cdn:dry-run     # prints the plan, uploads nothing
npm run publish:cdn
```

Bundles land in R2 under an immutable, versioned prefix and a small mutable
pointer flips a release live:

```
minigames/<slug>/<version>/index.html          immutable, 1y
minigames/<slug>/<version>/assets/*            immutable, 1y
minigames/<slug>/<version>/neo-manifest.json   immutable, 1y
meta/minigames/<slug>/latest.json              60s — the pointer the platform reads
catalog/minigames.json                         60s — meta + logo for the launcher grid
```

Because the version is in the path, a rollback is a pointer flip rather than a
re-upload, and the platform never has to bust an asset cache.

Credentials come from the environment (`CLOUDFLARE_API_TOKEN`,
`CF_API_TOKEN_ID`, `CLOUDFLARE_ACCOUNT_ID`, `MINIAPP_R2_BUCKET`); see
`scripts/publish-bundles-r2.mjs`.

## Contracts

```bash
npm run build:contracts
npm run check:devpack-drift
```

`contracts/MiniApp.DevPack` is vendored: Neo contracts compile their base
classes in via `<Compile Include>` rather than linking a package, so there is
no dependency form to use. `check:devpack-drift` fails if the vendored copy
diverges from the platform's canonical one.
