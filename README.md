# GitHub Actions for Gradle builds
.
This repository contains a set of GitHub Actions that are useful for building Gradle projects on GitHub.

## The `setup-gradle` action

The `setup-gradle` action can be used to configure Gradle for optimal execution on any platform supported by GitHub Actions.

This replaces the previous `gradle/gradle-build-action`, which now delegates to this implementation.

The recommended way to execute any Gradle build is with the help of the [Gradle Wrapper](https://docs.gradle.org/current/userguide/gradle_wrapper.html), and the examples assume that the Gradle Wrapper has been configured for the project. See [this example](docs/setup-gradle.md#build-with-a-specific-gradle-version) if your project doesn't use the Gradle Wrapper.

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
    - name: Setup Java
      uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: 17
    - name: Setup Gradle
      uses: gradle/actions/setup-gradle@v3
    - name: Build with Gradle
      run: ./gradlew build
```

See the [full action documentation](docs/setup-gradle.md) for more advanced usage scenarios.

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
    - name: Setup Java
      uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: 17
    - name: Generate and submit dependency graph
      uses: gradle/actions/dependency-submission@v3
```

See the [full action documentation](docs/dependency-submission.md) for more advanced usage scenarios.
