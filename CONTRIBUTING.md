## How to merge a Dependabot PR

The "distribution" for a GitHub Action is checked into the repository itself. 
In the case of these actions, the transpiled sources are committed to the `dist` directory. 
Any production dependencies are inlined into the distribution. 
So if a Dependabot PR updates a production dependency (or a dev dependency that changes the distribution, like the Typescript compiler), 
then a manual step is required to rebuild the dist and commit.

The simplest process to follow is:
1. Checkout the dependabot branch locally eg: `git checkout dependabot/npm_and_yarn/actions/github-5.1.0`
2. In the `sources` directory, run `npm install` to download NPM dependencies
3. In the `sources` directory, run `npm run build` to regenerate the distribution
4. Push the changes to the dependabot branch
5. If/when the checks pass, you can merge the dependabot PR

## Using `act` to run integ-test workflows locally

It's possible to run GitHub Actions workflows locally with https://nektosact.com/.
Many of the test workflows from this repository can be run in this way, making it easier to
test local changes without pushing to a branch.

This feature is most useful to run a single `integ-test-*` workflow. Avoid running `ci-quick-test` or other aggregating workflows unless you want to use your local machine as a heater!

Example running a single workflow:
`act -W .github/workflows/integ-test-caching-config.yml`

Example running a single job:
`act -W .github/workflows/integ-test-caching-config.yml -j cache-disabled-pre-existing-gradle-home`

Known issues:
- `integ-test-cache-cleanup.yml` fails because `gradle` is not installed on the runner. Should be fixed by #33.
- `integ-test-detect-java-toolchains.yml` fails when running on a `linux/amd64` container, since the expected pre-installed JDKs are not present. Should be fixed by #89.

Tips:
- Add the following lines to `~/.actrc`:
    - `--container-daemon-socket -` : Prevents "error while creating mount source path", and yes that's a solitary dash at the end
    - `--matrix os:ubuntu-latest` : Avoids a lot of logging about unsupported runners being skipped
- Runners don't have `java` installed by default, so all workflows that run Gradle require a `setup-java` step.