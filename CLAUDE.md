# Workspace Instructions

## Vendored Library Flow

This repository uses a proprietary caching library: `gradle-actions-caching`.

- The vendored copy lives at `sources/vendor/gradle-actions-caching`
- The source code is at `../actions-caching` and https://github.com/gradle/actions-caching

When a task involves building, updating, validating, or testing the vendored `gradle-actions-caching` library, use this sequence:

1. Run `npm run build` in `actions-caching`.
2. Copy (overwrite) the contents of `actions-caching/dist/` onto `sources/vendor/gradle-actions-caching/`. (No need to rm the existing contents)
3. Then continue with any build, test, or validation steps in this repository.

Do not treat `actions/sources/vendor/gradle-actions-caching` as the source of truth. The source of truth is `actions-caching`, and the vendor directory must be refreshed from its `dist/` output after rebuilding.

## Building

Before running any build or npm commands, initialize the PATH:

```sh
source ~/.zshrc
```

To build this repository, run the `build` script at the root of that repository with no arguments:

```sh
./build
```

## dist directory

Never make direct changes to the 'dist' directory. Building with npm will populate 'sources/dist' which is enough. There is a CI workflow that will update the 'dist' directory when required.
