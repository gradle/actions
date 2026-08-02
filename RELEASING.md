# Gradle GitHub Actions release process

## Preparation
- Push any outstanding changes to branch main.
- Check that https://github.com/gradle/actions/actions is green for all workflows for the main branch.
  - This should include any workflows triggered by `[bot] Update dist directory`
- Decide on the version number to use for the release. The action releases should follow semantic versioning.
  - By default, a patch release is assumed (eg. `4.0.0` → `4.0.1`)
  - If new features have been added, bump the minor version (eg `4.1.1` → `4.2.0`)
  - If a new major release is required, bump the major version (eg `4.1.1` → `5.0.0`)
  - Note: The gradle actions follow the GitHub Actions convention of including a .0 patch number for the first release of a minor version, unlike the Gradle convention which omits the trailing .0.
- Release immutability is a one-time repository setting (Settings → General → Releases → "Enable release immutability"), and applies to every release published thereafter.

## Release gradle/actions

> [!IMPORTANT]
> Releases in this repository are [immutable](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).
> Once a release is published, its Git tag is permanently locked to a commit and its assets can no
> longer be changed. Deleting the release does not release the tag name for reuse — a mistake in
> `v6.3.0` means the next release must be `v6.3.1`. Everything below is ordered so that the tag is
> correct *before* anything is published.
>
> Drafts are exempt: a draft release, and its tag, can still be edited or deleted freely.

- Create and push the tag for the release **before** drafting it. The tag should have the format `v6.2.0`
  - Your HEAD must point at the commit to be released.
  - From CLI: `git tag -s -m "v6.2.0" v6.2.0 && git push --tags`
  - Note that we sign the tag and set the commit message for the tag to the newly released version.
  - Do **not** let GitHub create the tag when the release is published. It creates an unsigned,
    lightweight tag pointing at whatever `main` resolves to at that moment — so anything merged
    while the draft was open is silently included. Immutability makes both permanent.
- Go to https://github.com/gradle/actions/releases and "Draft new release"
  - Select the existing tag — do not use "Create new tag on publish" — and copy the tag name exactly as the release title.
  - Craft release notes content based on issues closed, PRs merged and commits
  - Include a Full changelog link in the format https://github.com/gradle/actions/compare/v2.12.0...v3.0.0
  - Finalize the notes now, while the release is still a draft.
- Publish the release.
  - Confirm immutability took effect: `gh api repos/gradle/actions/releases/tags/v6.2.0 --jq .immutable` should print `true`.
- Force push the `v6` tag (or current major version) to point to the new release. It is conventional for users to bind to a major release version using this tag.
  - From CLI: `git tag -f -s -a -m "v6.2.0" v6 && git push -f --tags`
  - Note that we sign the tag and set the commit message for the tag to the newly released version.
  - Your HEAD must point at the commit to be tagged.
  - Never attach a GitHub release to the `v6` tag. Immutability locks only those tags that have a
    release of their own, so the major tag remains movable precisely as long as it has none.

## Post release steps

Submit PRs to update the GitHub starter workflow. Starter workflows contain content that should reference the Git hash of the current gradle/actions release:
https://github.com/actions/starter-workflows has [gradle](https://github.com/actions/starter-workflows/blob/main/ci/gradle.yml) and [gradle-publish](https://github.com/actions/starter-workflows/blob/main/ci/gradle-publish.yml): see [the v4.0.0 update PR](https://github.com/actions/starter-workflows/pull/2468) for an example.

Submit PRs to update the GitHub documentation. The documentation contains content that should reference the Git hash of the current gradle/actions release:
https://github.com/github/docs has [building-and-testing-java-with-gradle](https://github.com/github/docs/blob/main/content/actions/automating-builds-and-tests/building-and-testing-java-with-gradle.md) and [publishing-java-packages-with-gradle](https://github.com/github/docs/blob/main/content/actions/publishing-packages/publishing-java-packages-with-gradle.md) : see [the v4.0.0 update PR](https://github.com/github/docs/pull/34239) for an example.
