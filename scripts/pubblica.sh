#!/bin/sh
# Pubblica l'app su GitHub Pages: costruisce la versione finale e la carica
# sul ramo "gh-pages" del repository. Si lancia con: npm run pubblica
# (serve aver fatto l'accesso con: gh auth login)
set -e

# Indirizzo del repository (lo stesso del codice).
REPO=$(git remote get-url origin)
GH="${GH:-$HOME/.local/gh/bin/gh}"

npm run build

# La cartella dist/ diventa un piccolo repository a sé, che sostituisce
# il contenuto del ramo gh-pages.
cd dist
touch .nojekyll # dice a GitHub di pubblicare i file così come sono
rm -rf .git
git init -q -b gh-pages
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" \
  add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" \
  commit -q -m "Pubblicazione $(date '+%Y-%m-%d %H:%M')"
git -c credential.helper= -c credential.helper="!$GH auth git-credential" \
  push -q -f "$REPO" gh-pages
rm -rf .git
echo "Pubblicata: tra un paio di minuti è online."
