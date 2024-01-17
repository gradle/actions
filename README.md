# GitHub Actions for Gradle builds

This repository contains a set of GitHub Actions that are useful for building Gradle projects on GitHub.

## `gradle/actions/setup-gradle`

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

## `gradle/actions/dependency-submission`

Generates and submits a dependency graph for a Gradle project. This action is designed to be used in a standalone workflow.
The intention is to provide a simple, standardised way to enable Dependency Graph support for Gradle repositories,
with a long-term goal of having this functionality enabled by default for Gradle projects on GitHub.

### Example usage
```yaml
name: Dependency Submission

on:
  workflow_dispatch:
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
