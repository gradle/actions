# Gradle GitHub Actions release process

## Preparation
- Push any outstanding changes to branch main. For any change that impacts the released action, you must run npm via `./build all` and commit the various files generated into the dist directory.
- Check that https://github.com/gradle/actions/actions is green for all workflows for the main branch.
- Decide on the version number to use for the release. The action releases should follow semantic versioning.
  - By default, a patch release is assumed (eg. `3.0.0` → `3.0.1`)
  - If new features have been added, bump the minor version (eg `3.1.1` → `3.2.0`)
  - If a new major release is required, bump the major version (eg `3.1.1` → `4.0.0`)
  - Note: The gradle actions follow the GitHub Actions convention of including a .0 patch number for the first release of a minor version, unlike the Gradle convention which omits the trailing .0.

## Release gradle/actions
- Create a tag for the release. The tag should have the format `v3.1.0`
  - From CLI: `git tag v3.1.0`
- Push the commit and tag
  - From CLI: `git push --tags`
- Go to https://github.com/gradle/actions/releases and "Draft new release"
  - Use the newly created tag and copy the tag name exactly as the release title.
  - Craft release notes content based on issues closed, PRs merged and commits
  - Include a Full changelog link in the format https://github.com/gradle/actions/compare/v2.12.0...v3.0.0
- Publish the release. Before using "Publish release", check that action workflows are green for the version tag. eg https://github.com/gradle/actions/actions?query=branch%3Av3.0.0
- Force push the `v3` tag (or current major version) to point to the new release. It is conventional for users to bind to a major release version using this tag.
  - From CLI: `git tag -f -a -m "v3.0.0" v3 v3.0.0 && git push -f --tags`
  - Note that we set the commit message for the tag to the newly released version.

## Release gradle/gradle-build-action

During the 3.x release series, we will continue to publish parallel releases of `gradle/gradle-build-action`. These releases will simply delegate to `gradle/actions/setup-gradle` with the same version.

- Update the gradle-build-action action.yml file to point to the newly released version of gradle/actions/setup-gradle.
- Ensure that any parameters that have been added to the setup-gradle action are added to the gradle-build-action definition, and that these are passed on to setup-gradle.
- Create and push a tag for the release.
  - From CLI: `git tag v3.1.0 && git push --tags`
- Go to https://github.com/gradle/actions/releases and "Draft new release"
  - Use the newly created tag and copy the tag name exactly as the release title.
  - In the release notes, point users to the gradle/actions release. Include a header informing users to switch to gradle/actions/setup-gradle.
- Publish the release.
- Force push the `v3` tag (or current major version) to point to the new release.
  - From CLI: `git tag -f -a -m "v3.0.0" v3 v3.0.0 && git push -f --tags`

## Post release steps

Submit PRs to update the GitHub starter workflow. Starter workflows contain content that should reference the Git hash of the current gradle/actions release:
https://github.com/actions/starter-workflows has gradle and gradle-publish: see the v2.1.4 update PR for an example.

Submit PRs to update the GitHub documentation. The documentation contains content that should reference the Git hash of the current gradle/actions release:
https://github.com/github/docs has building-and-testing-java-with-gradle and publishing-java-packages-with-gradle : see the v2.1.4 update PR for an example.

