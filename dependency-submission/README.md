# The `dependency-submission` action

Generates and submits a dependency graph for a Gradle project. This action is designed to be used in a standalone workflow.
The intention is to provide a simple, standardised way to enable Dependency Graph support for Gradle repositories,
with a long-term goal of having this functionality enabled by default for Gradle projects on GitHub.

## General usage

The following workflow will generate a dependency graph for a Gradle project and submit it immediately to the repository via the
Dependency Submission API. For most projects, this default configuration should be all that you need.

Simply add this as a new workflow file to your repository (eg `.github/workflows/dependency-submission.yml`).

```yaml
name: Dependency Submission

on: [ push ]

permissions:
  contents: write

jobs:
  dependency-submission:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Generate and submit dependency graph
      uses: gradle/actions/dependency-submission@v3
```

### Configuration parameters

In some cases, the default action configuration will not be sufficient, and additional action parameters will need to be specified.

See the example below for a summary, and the [Action Metadata file](../dependency-submission/action.yml) for a more detailed description of each input parameter.

```yaml
name: Dependency Submission with advanced config

on: [ push ]

permissions:
  contents: read

jobs:
  dependency-submission:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Generate and save dependency graph
      uses: gradle/actions/dependency-submission@v3
      with:
        # Use a particular Gradle version instead of the configured wrapper.
        gradle-version: 8.6-rc-2

        # The gradle project is not in the root of the repository.
        build-root-directory: my-gradle-project

        # Enable configuration-cache reuse for this build.
        cache-encryption-key: ${{ secrets.GRADLE_ENCRYPTION_KEY }}

        # Do not attempt to submit the dependency-graph. Save it as a workflow artifact.
        dependency-graph: generate-and-upload
```

## Integrating the `dependency-review-action`

The GitHub [dependency-review-action](https://github.com/actions/dependency-review-action) helps you 
understand dependency changes (and the security impact of these changes) for a pull request,
by comparing the dependency graph for the pull-request with that of the HEAD commit.

Example of a pull request workflow that executes a build for a pull request and runs the `dependency-review-action`:

```yaml
name: Dependency review for pull requests

on: [ pull_request ]

permissions:
  contents: write

jobs:
  dependency-submission:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Generate and submit dependency graph
      uses: gradle/actions/dependency-submission@v3
  
  dependency-review:
    needs: dependency-submission
    runs-on: ubuntu-latest
    steps:
    - name: Perform dependency review
      uses: actions/dependency-review-action@v3
```

Note that the `dependency-submission` action submits the dependency graph at the completion of the workflow Job.
For this reason, the `dependency-review-action` must be executed in a dependent job, and not as a subsequent step in the job that generates the dependency graph.

## Usage with pull requests from public forked repositories

This `contents: write` permission is [not available for any workflow that is triggered by a pull request submitted from a public forked repository](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token).
This limitation is designed to prevent a malicious pull request from effecting repository changes.

Because of this restriction, we require 2 separate workflows in order to generate and submit a dependency graph:
1. The first workflow runs directly against the pull request sources and will `generate-and-upload` the dependency graph.
2. The second workflow is triggered on `workflow_run` of the first workflow, and will `download-and-submit` the previously saved dependency graph.

***Main workflow file***
```yaml
name: Generate and save dependency graph

on: [ pull_request ]

permissions:
  contents: read # 'write' permission is not available

jobs:
  dependency-submission:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Generate and save dependency graph
      uses: gradle/actions/dependency-submission@v3
      with:
        dependency-graph: generate-and-upload
```

***Dependent workflow file***
```yaml
name: Download and submit dependency graph

on:
  workflow_run:
    workflows: ['Generate and save dependency graph']
    types: [completed]

permissions:
  contents: write

jobs:
  submit-dependency-graph:
    runs-on: ubuntu-latest
    steps:
    - name: Download and submit dependency graph
      uses: gradle/actions/dependency-submission@v3
      with:
        dependency-graph: download-and-submit # Download saved dependency-graph and submit
```

### Integrating `dependency-review-action` for pull requests from public forked repositories

To integrate the `dependency-review-action` into the pull request workflows above, a third workflow file is required.
This workflow will be triggered directly on `pull_request`, but will wait until the dependency graph results are
submitted before the dependency review can complete. The period to wait is controlled by the `retry-on-snapshot-warnings` input parameters.

Here's an example of a separate "Dependency Review" workflow that will wait for 10 minutes for the above PR check workflow to complete.

```yaml
name: dependency-review

on: [ pull_request ]

permissions:
  contents: read

jobs:
  dependency-review:
    runs-on: ubuntu-latest
    steps:
    - name: 'Dependency Review'
      uses: actions/dependency-review-action@v3
      with:
        retry-on-snapshot-warnings: true
        retry-on-snapshot-warnings-timeout: 600
```

The `retry-on-snapshot-warnings-timeout` (in seconds) needs to be long enough to allow the entire `Generate and save dependency graph` and `Download and submit dependency graph` workflows (above) to complete.

## Gradle version compatibility

Dependency-graph generation is compatible with most versions of Gradle >= `5.2`, and is tested regularly against 
Gradle versions `5.2.1`, `5.6.4`, `6.0.1`, `6.9.4`, `7.1.1` and `7.6.3`, as well as all patched versions of Gradle 8.x.

A known exception to this is that Gradle `7.0`, `7.0.1` and `7.0.2` are not supported.
