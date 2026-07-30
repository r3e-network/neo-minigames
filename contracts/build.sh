#!/bin/bash
# Compile every game contract in this repo to build/.
#
# The platform's own contracts (PlatformGame, PlatformRegistry, ...) are built in
# neo-os-contracts. What is built here is the game layer plus the one platform
# test double the game tests deploy against - see GameOracleMockFixture below.
set -e

script_dir="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/dotnet_tools.sh
source "$script_dir/../scripts/lib/dotnet_tools.sh"
cd "$script_dir"
mkdir -p build

ensure_dotnet_root
NCCS_BIN="$(resolve_dotnet_tool nccs 'dotnet tool install -g Neo.Compiler.CSharp')"

legacy_clone_projects=(
  MiniAppAimMaster
  MiniAppColorClash
  MiniAppCurveArrow
  MiniAppFlappyDash
  MiniAppGame2048
  MiniAppJumpRush
  MiniAppMergeKingdom
  MiniAppPetPotion
  MiniAppSheepSolitaire
  MiniAppSnakeBounty
  MiniAppSudoku
)

include_legacy_clones=false
case "${BUILD_LEGACY_CLONES:-0}" in
  1|true|TRUE|yes|YES|on|ON) include_legacy_clones=true ;;
esac

is_legacy_clone_project() {
  local project_name="$1"
  for legacy_clone_project in "${legacy_clone_projects[@]}"; do
    if [[ "$project_name" == "$legacy_clone_project" ]]; then
      return 0
    fi
  done
  return 1
}

echo "=== Building Game Contracts ==="
if [[ "$include_legacy_clones" == true ]]; then
  echo "Legacy game clones: included (BUILD_LEGACY_CLONES=${BUILD_LEGACY_CLONES})"
else
  echo "Legacy game clones: skipped (set BUILD_LEGACY_CLONES=1 for recovery/tests)"
fi

# MiniAppTarotVrf and the oracle mock it is tested against must be compiled with
# Neo.Compiler.CSharp 3.9.1 and --checked. Building them in the loop below would
# use whichever nccs is installed and drop --checked, producing artifacts that
# load but fail their tests - so they are excluded here and built by
# scripts/build_tarot_vrf.sh, which pins the compiler and fails loudly on the
# wrong version.
tarot_vrf_projects=(
  MiniAppTarotVrf
  TarotOracleMockFixture
)

is_tarot_vrf_project() {
  local project_name="$1"
  for tarot_vrf_project in "${tarot_vrf_projects[@]}"; do
    if [[ "$project_name" == "$tarot_vrf_project" ]]; then
      return 0
    fi
  done
  return 1
}

find . -mindepth 2 -maxdepth 3 -name '*.csproj' \
  ! -path './__tests__/*' | sort | while read -r project; do
  d="$(basename "$(dirname "$project")")"
  if [[ "$include_legacy_clones" != true ]] && is_legacy_clone_project "$d"; then
    continue
  fi
  if is_tarot_vrf_project "$d"; then
    echo "Skipping $d (built by scripts/build_tarot_vrf.sh with the pinned compiler)"
    continue
  fi
  echo "Building $d..."
  dotnet build "$project" -c Release
  "$NCCS_BIN" "$project" --optimize=All --output ./build/
done

echo "=== Build Complete ==="
echo "MiniAppTarotVrf is NOT built here - run scripts/build_tarot_vrf.sh for it."
