# GitHub Actions for Gradle builds

This repository contains a set of GitHub Actions that are useful for building Gradle projects on GitHub.

## The `setup-gradle` action

A simple wrapper around `gradle/gradle-build-action`, removing the deprecated `arguments` parameter (and thus removing the ability to _execute_ gradle).
The intention is to eventually deprecate `gradle-build-action` with this being the replacement.

### Example usage

```yaml
name: Build

on:
  workflow_dispatch:
  push:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Setup Gradle
      uses: gradle/actions/setup-gradle@v0
    - name: Build with Gradle
      run: ./gradlew build
```

See the [`gradle-build-action` documentation](https://github.com/gradle/gradle-build-action/blob/main/README.md) for a full description of this action.

## The `dependency-submission` action

Generates and submits a dependency graph for a Gradle project, allowing GitHub to alert about reported vulnerabilities in your project dependencies.


The following workflow will generate a dependency graph for a Gradle project and submit it immediately to the repository via the
Dependency Submission API. For most projects, this default configuration should be all that you need.

Simply add this as a new workflow file to your repository (eg `.github/workflows/dependency-submission.yml`).

```yaml
name: Dependency Submission

on:
  push:
    branches:
    - main

permissions:
  contents: write

jobs:
  dependency-submission:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Generate and submit dependency graph
      uses: gradle/actions/dependency-submission@v0
```

See the [full action documentation](dependency-submission/README.md) for more advanced usage scenarios.
