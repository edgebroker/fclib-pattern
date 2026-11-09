# Unlike the other fclibs, the components already live under Pattern/,
# so that directory is staged instead of the repo root.
rm -f Pattern.flowcomponents
mkdir out
mkdir out/Pattern
rsync -av Pattern/ out/Pattern --exclude .idea --exclude .DS_Store
cd out
zip -r ../Pattern.flowcomponents Pattern
cd ..
rm -Rf out
