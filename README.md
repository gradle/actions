# GitHub Actions for Gradle builds

This repository contains a set of GitHub Actions that are useful for building Gradle projects on GitHub.

## The `setup-gradle` action

This replaces the previous `gradle/gradle-build-action`, which now delegates to this implementation.

### Example usage

```yaml
name: Build

on: [ push ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Setup Gradle
      uses: gradle/actions/setup-gradle@v3-beta
    - name: Build with Gradle
      run: ./gradlew build
```

See the [full action documentation](setup-gradle/README.md) for more advanced usage scenarios.

## The `dependency-submission` action

Generates and submits a dependency graph for a Gradle project, allowing GitHub to alert about reported vulnerabilities in your project dependencies.

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
      uses: gradle/actions/dependency-submission@v3-beta
```

See the [full action documentation](dependency-submission/README.md) for more advanced usage scenarios.
